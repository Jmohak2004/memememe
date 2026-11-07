// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title CreatorToken
/// @notice A fair-launch creator coin. Trades against its own bonding curve (no LP to rug),
///         and every trade fee is split between creator, ALL holders (pro-rata dividends) and protocol.
///         Allocation: 80% curve / 10% creator (linear vesting) / 10% community airdrop (merkle).
///         Early sells pay a decaying penalty that is redistributed to the remaining holders.
contract CreatorToken is ERC20, ReentrancyGuard {
    uint256 private constant MAG = 2 ** 128;
    uint256 public constant BPS = 10_000;

    // ---- immutable config
    address public immutable creator;
    address public immutable protocol;
    uint256 public immutable maxSupply;
    uint256 public immutable curveSupply;
    uint256 public immutable creatorAllocation;
    uint256 public immutable airdropAllocation;
    uint256 public immutable vestStart;
    uint256 public immutable vestDuration;
    uint256 public immutable vEth0; // initial virtual ETH
    uint256 public immutable vTok0; // initial virtual tokens
    uint256 public immutable k;

    // fee config (bps of trade value)
    uint16 public constant FEE_BPS = 100; // 1%
    uint16 public constant CREATOR_SHARE = 4000; // of fee
    uint16 public constant HOLDER_SHARE = 4000;
    uint16 public constant PROTOCOL_SHARE = 2000;
    uint16 public constant MAX_EARLY_SELL_PENALTY_BPS = 1000; // 10%
    uint256 public constant PENALTY_WINDOW = 24 hours;

    // ---- curve state
    uint256 public vEth;
    uint256 public vTok;

    // ---- metadata
    string public metadataURI;

    // ---- fee accounting
    uint256 public creatorFees;
    uint256 public protocolFees;

    // ---- holder dividends
    uint256 private magnifiedPerShare;
    mapping(address => int256) private correction;
    mapping(address => uint256) public dividendsWithdrawn;
    uint256 public totalDividendsDistributed;

    // ---- anti-dump
    mapping(address => uint256) public lastBuyAt;

    // ---- vesting / airdrop
    uint256 public creatorClaimed;
    bytes32 public airdropRoot;
    uint256 public airdropClaimed;
    mapping(address => bool) public airdropDone;

    event Bought(address indexed buyer, uint256 ethIn, uint256 tokensOut, uint256 fee);
    event Sold(address indexed seller, uint256 tokensIn, uint256 ethOut, uint256 fee, uint256 penalty);
    event DividendsDistributed(uint256 amount);
    event DividendWithdrawn(address indexed holder, uint256 amount);
    event CreatorVested(uint256 amount);
    event AirdropRootSet(bytes32 root);
    event AirdropClaimed(address indexed account, uint256 amount);
    event MetadataUpdated(string uri);

    error NotCreator();
    error Slippage();
    error ZeroAmount();
    error CurveFull();
    error RootAlreadySet();
    error BadProof();
    error AlreadyClaimed();
    error AirdropCapExceeded();
    error TransferFailed();

    constructor(
        string memory name_,
        string memory symbol_,
        address creator_,
        address protocol_,
        uint256 maxSupply_,
        uint256 vEth0_,
        uint256 vestDuration_,
        string memory metadataURI_
    ) ERC20(name_, symbol_) {
        creator = creator_;
        protocol = protocol_;
        maxSupply = maxSupply_;
        curveSupply = (maxSupply_ * 80) / 100;
        creatorAllocation = (maxSupply_ * 10) / 100;
        airdropAllocation = maxSupply_ - curveSupply - creatorAllocation;
        vestStart = block.timestamp;
        vestDuration = vestDuration_;
        vEth0 = vEth0_;
        // virtual tokens exceed the sellable curve supply so price never explodes at the cap
        vTok0 = (curveSupply * 125) / 100;
        k = vEth0_ * vTok0;
        vEth = vEth0_;
        vTok = vTok0;
        metadataURI = metadataURI_;
    }

    // =====================================================================
    //                               TRADING
    // =====================================================================

    function tokensSold() public view returns (uint256) {
        return vTok0 - vTok;
    }

    /// @notice Price of 1 whole token in wei (marginal).
    function spotPrice() external view returns (uint256) {
        return (vEth * 1e18) / vTok;
    }

    function quoteBuy(uint256 ethIn) public view returns (uint256 tokensOut, uint256 ethUsed, uint256 fee) {
        fee = (ethIn * FEE_BPS) / BPS;
        uint256 net = ethIn - fee;
        uint256 newVEth = vEth + net;
        uint256 newVTok = _ceilDiv(k, newVEth);
        tokensOut = vTok - newVTok;
        uint256 remaining = curveSupply - tokensSold();
        if (tokensOut > remaining) {
            tokensOut = remaining;
            newVTok = vTok - remaining;
            newVEth = _ceilDiv(k, newVTok);
            net = newVEth - vEth;
            // gross up so that fee is FEE_BPS of the amount actually used
            ethUsed = (net * BPS) / (BPS - FEE_BPS) + 1;
            if (ethUsed > ethIn) ethUsed = ethIn;
            fee = ethUsed - net;
        } else {
            ethUsed = ethIn;
        }
    }

    function quoteSell(address seller, uint256 tokensIn)
        public
        view
        returns (uint256 ethOut, uint256 fee, uint256 penalty)
    {
        uint256 newVTok = vTok + tokensIn;
        uint256 newVEth = _ceilDiv(k, newVTok);
        uint256 gross = vEth - newVEth;
        fee = (gross * FEE_BPS) / BPS;
        penalty = (gross * earlySellPenaltyBps(seller)) / BPS;
        ethOut = gross - fee - penalty;
    }

    function earlySellPenaltyBps(address who) public view returns (uint256) {
        uint256 t = lastBuyAt[who];
        if (t == 0) return 0;
        uint256 elapsed = block.timestamp - t;
        if (elapsed >= PENALTY_WINDOW) return 0;
        return (MAX_EARLY_SELL_PENALTY_BPS * (PENALTY_WINDOW - elapsed)) / PENALTY_WINDOW;
    }

    function buy(uint256 minTokensOut) external payable nonReentrant returns (uint256 tokensOut) {
        if (msg.value == 0) revert ZeroAmount();
        if (curveSupply == tokensSold()) revert CurveFull();
        uint256 ethUsed;
        uint256 fee;
        (tokensOut, ethUsed, fee) = quoteBuy(msg.value);
        if (tokensOut < minTokensOut || tokensOut == 0) revert Slippage();

        uint256 net = ethUsed - fee;
        vEth += net;
        vTok -= tokensOut;

        // distribute fee BEFORE minting so the buyer does not earn dividends on their own fee
        _distributeFee(fee, 0);

        lastBuyAt[msg.sender] = block.timestamp;
        _mint(msg.sender, tokensOut);

        if (msg.value > ethUsed) _send(msg.sender, msg.value - ethUsed);
        emit Bought(msg.sender, ethUsed, tokensOut, fee);
    }

    function sell(uint256 tokensIn, uint256 minEthOut) external nonReentrant returns (uint256 ethOut) {
        if (tokensIn == 0) revert ZeroAmount();
        (uint256 out, uint256 fee, uint256 penalty) = quoteSell(msg.sender, tokensIn);
        if (out < minEthOut) revert Slippage();
        ethOut = out;

        vEth -= (ethOut + fee + penalty);
        vTok += tokensIn;
        _burn(msg.sender, tokensIn);

        // after the burn, penalty+holder share go to the remaining holders
        _distributeFee(fee, penalty);
        _send(msg.sender, ethOut);
        emit Sold(msg.sender, tokensIn, ethOut, fee, penalty);
    }

    // The virtual reserve tracks the trading ETH; fees are carved out of it, so they stay in the
    // contract balance but are accounted in creatorFees/protocolFees/dividends.
    function _distributeFee(uint256 fee, uint256 penalty) internal {
        if (fee == 0 && penalty == 0) return;
        uint256 toCreator = (fee * CREATOR_SHARE) / BPS;
        uint256 toProtocol = (fee * PROTOCOL_SHARE) / BPS;
        uint256 toHolders = fee - toCreator - toProtocol + penalty;
        creatorFees += toCreator;
        protocolFees += toProtocol;
        uint256 supply = totalSupply();
        if (supply == 0) {
            creatorFees += toHolders; // nobody to pay yet
        } else if (toHolders > 0) {
            magnifiedPerShare += (toHolders * MAG) / supply;
            totalDividendsDistributed += toHolders;
            emit DividendsDistributed(toHolders);
        }
    }

    // =====================================================================
    //                              DIVIDENDS
    // =====================================================================

    function accumulativeDividendOf(address a) public view returns (uint256) {
        int256 v = int256(magnifiedPerShare * balanceOf(a)) + correction[a];
        return uint256(v) / MAG;
    }

    function withdrawableDividendOf(address a) public view returns (uint256) {
        return accumulativeDividendOf(a) - dividendsWithdrawn[a];
    }

    function claimDividends() external nonReentrant returns (uint256 amt) {
        amt = withdrawableDividendOf(msg.sender);
        if (amt == 0) revert ZeroAmount();
        dividendsWithdrawn[msg.sender] += amt;
        _send(msg.sender, amt);
        emit DividendWithdrawn(msg.sender, amt);
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        int256 c = int256(magnifiedPerShare * value);
        if (from == address(0)) {
            correction[to] -= c;
        } else if (to == address(0)) {
            correction[from] += c;
        } else {
            correction[from] += c;
            correction[to] -= c;
        }
    }

    // =====================================================================
    //                       CREATOR: FEES / VESTING / AIRDROP
    // =====================================================================

    function claimCreatorFees() external nonReentrant {
        uint256 a = creatorFees;
        if (a == 0) revert ZeroAmount();
        creatorFees = 0;
        _send(creator, a);
    }

    function claimProtocolFees() external nonReentrant {
        uint256 a = protocolFees;
        if (a == 0) revert ZeroAmount();
        protocolFees = 0;
        _send(protocol, a);
    }

    function vestedAmount() public view returns (uint256) {
        uint256 elapsed = block.timestamp - vestStart;
        if (elapsed >= vestDuration) return creatorAllocation;
        return (creatorAllocation * elapsed) / vestDuration;
    }

    /// @notice Creator tokens unlock linearly; there is no way to receive them up-front.
    function claimVested() external returns (uint256 amt) {
        if (msg.sender != creator) revert NotCreator();
        amt = vestedAmount() - creatorClaimed;
        if (amt == 0) revert ZeroAmount();
        creatorClaimed += amt;
        lastBuyAt[creator] = block.timestamp; // vested tokens are subject to the early-sell penalty too
        _mint(creator, amt);
        emit CreatorVested(amt);
    }

    function setAirdropRoot(bytes32 root) external {
        if (msg.sender != creator) revert NotCreator();
        if (airdropRoot != bytes32(0)) revert RootAlreadySet();
        airdropRoot = root;
        emit AirdropRootSet(root);
    }

    /// @notice Subscribers claim their share of the community allocation. Leaf = keccak(keccak(abi.encode(account, amount))).
    function claimAirdrop(uint256 amount, bytes32[] calldata proof) external {
        if (airdropDone[msg.sender]) revert AlreadyClaimed();
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount))));
        if (!MerkleProof.verifyCalldata(proof, airdropRoot, leaf)) revert BadProof();
        if (airdropClaimed + amount > airdropAllocation) revert AirdropCapExceeded();
        airdropDone[msg.sender] = true;
        airdropClaimed += amount;
        _mint(msg.sender, amount);
        emit AirdropClaimed(msg.sender, amount);
    }

    function setMetadataURI(string calldata uri) external {
        if (msg.sender != creator) revert NotCreator();
        metadataURI = uri;
        emit MetadataUpdated(uri);
    }

    // =====================================================================

    function _send(address to, uint256 amt) internal {
        (bool ok,) = to.call{value: amt}("");
        if (!ok) revert TransferFailed();
    }

    function _ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return a == 0 ? 0 : (a - 1) / b + 1;
    }
}
