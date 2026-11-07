// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CreatorToken} from "./CreatorToken.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title CreatorTokenFactory
/// @notice Anyone (an influencer) can launch a CreatorToken with a supply of their choosing.
contract CreatorTokenFactory is Ownable {
    uint256 public constant MIN_SUPPLY = 1_000_000e18;
    uint256 public constant MAX_SUPPLY = 1_000_000_000_000e18;
    uint256 public constant MIN_VETH = 0.01 ether;
    uint256 public constant MAX_VETH = 1_000 ether;
    uint256 public constant MIN_VEST = 7 days;

    address public treasury;
    uint256 public launchFee;

    address[] public allTokens;
    mapping(address => address[]) private _byCreator;
    mapping(address => bool) public isToken;

    event TokenCreated(
        address indexed token, address indexed creator, string name, string symbol, uint256 maxSupply, uint256 vEth0
    );
    event TreasuryUpdated(address treasury);
    event LaunchFeeUpdated(uint256 fee);

    error BadParams();
    error WrongFee();

    constructor(address treasury_, uint256 launchFee_) Ownable(msg.sender) {
        treasury = treasury_;
        launchFee = launchFee_;
    }

    /// @param maxSupply total supply cap in wei-units (18 decimals); 80% curve / 10% creator / 10% community
    /// @param vEth0 starting virtual ETH; lower = cheaper start price. Starting price ~= vEth0 / (1.25 * 0.8 * maxSupply)
    /// @param vestDuration creator allocation unlock period (>= 7 days)
    function createToken(
        string calldata name,
        string calldata symbol,
        uint256 maxSupply,
        uint256 vEth0,
        uint256 vestDuration,
        string calldata metadataURI
    ) external payable returns (address token) {
        if (msg.value != launchFee) revert WrongFee();
        if (
            bytes(name).length == 0 || bytes(name).length > 48 || bytes(symbol).length == 0
                || bytes(symbol).length > 12 || maxSupply < MIN_SUPPLY || maxSupply > MAX_SUPPLY || vEth0 < MIN_VETH
                || vEth0 > MAX_VETH || vestDuration < MIN_VEST
        ) revert BadParams();

        token = address(
            new CreatorToken(name, symbol, msg.sender, treasury, maxSupply, vEth0, vestDuration, metadataURI)
        );
        allTokens.push(token);
        _byCreator[msg.sender].push(token);
        isToken[token] = true;
        emit TokenCreated(token, msg.sender, name, symbol, maxSupply, vEth0);

        if (msg.value > 0) {
            (bool ok,) = treasury.call{value: msg.value}("");
            require(ok, "fee transfer");
        }
    }

    function allTokensLength() external view returns (uint256) {
        return allTokens.length;
    }

    function tokensByCreator(address c) external view returns (address[] memory) {
        return _byCreator[c];
    }

    function getTokens(uint256 offset, uint256 limit) external view returns (address[] memory out) {
        uint256 n = allTokens.length;
        if (offset >= n) return out;
        uint256 end = offset + limit > n ? n : offset + limit;
        out = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) out[i - offset] = allTokens[i];
    }

    function setTreasury(address t) external onlyOwner {
        require(t != address(0), "zero");
        treasury = t;
        emit TreasuryUpdated(t);
    }

    function setLaunchFee(uint256 f) external onlyOwner {
        launchFee = f;
        emit LaunchFeeUpdated(f);
    }
}
