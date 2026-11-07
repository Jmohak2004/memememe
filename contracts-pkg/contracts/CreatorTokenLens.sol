// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CreatorToken} from "./CreatorToken.sol";
import {CreatorTokenFactory} from "./CreatorTokenFactory.sol";

/// @notice Read-only helper that batches everything a UI needs into one RPC call.
contract CreatorTokenLens {
    struct TokenInfo {
        address token;
        string name;
        string symbol;
        address creator;
        string metadataURI;
        uint256 totalSupply;
        uint256 maxSupply;
        uint256 curveSupply;
        uint256 tokensSold;
        uint256 spotPrice;
        uint256 totalDividends;
        uint256 creatorFees;
        uint256 vested;
        uint256 creatorClaimed;
        bytes32 airdropRoot;
        uint256 airdropClaimed;
        uint256 airdropAllocation;
    }

    struct UserInfo {
        uint256 balance;
        uint256 pendingDividends;
        uint256 earlySellPenaltyBps;
        bool airdropClaimed;
    }

    function tokenInfo(address token) public view returns (TokenInfo memory i) {
        CreatorToken t = CreatorToken(token);
        i.token = token;
        i.name = t.name();
        i.symbol = t.symbol();
        i.creator = t.creator();
        i.metadataURI = t.metadataURI();
        i.totalSupply = t.totalSupply();
        i.maxSupply = t.maxSupply();
        i.curveSupply = t.curveSupply();
        i.tokensSold = t.tokensSold();
        i.spotPrice = t.spotPrice();
        i.totalDividends = t.totalDividendsDistributed();
        i.creatorFees = t.creatorFees();
        i.vested = t.vestedAmount();
        i.creatorClaimed = t.creatorClaimed();
        i.airdropRoot = t.airdropRoot();
        i.airdropClaimed = t.airdropClaimed();
        i.airdropAllocation = t.airdropAllocation();
    }

    function userInfo(address token, address user) public view returns (UserInfo memory u) {
        CreatorToken t = CreatorToken(token);
        u.balance = t.balanceOf(user);
        u.pendingDividends = t.withdrawableDividendOf(user);
        u.earlySellPenaltyBps = t.earlySellPenaltyBps(user);
        u.airdropClaimed = t.airdropDone(user);
    }

    function page(CreatorTokenFactory factory, uint256 offset, uint256 limit) external view returns (TokenInfo[] memory out) {
        address[] memory list = factory.getTokens(offset, limit);
        out = new TokenInfo[](list.length);
        for (uint256 i; i < list.length; i++) out[i] = tokenInfo(list[i]);
    }

    /// @notice Total pending dividends for `user` across the given tokens.
    function portfolio(address[] calldata tokens, address user)
        external
        view
        returns (UserInfo[] memory infos, uint256 totalPending)
    {
        infos = new UserInfo[](tokens.length);
        for (uint256 i; i < tokens.length; i++) {
            infos[i] = userInfo(tokens[i], user);
            totalPending += infos[i].pendingDividends;
        }
    }
}
