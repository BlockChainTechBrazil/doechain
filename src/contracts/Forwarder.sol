// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/metatx/MinimalForwarder.sol";

/**
 * @title Forwarder
 * @dev Trusted Forwarder para meta-transactions (gasless)
 * Herda do MinimalForwarder da OpenZeppelin
 */
contract Forwarder is MinimalForwarder {
    constructor() MinimalForwarder() {}
}
