## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge create ./src/SavingsVault.sol:SavingsVault --rpc-url $CELO_SEPOLIA_RPC --account deployer --broadcast --constructor-args 0xControllerAdvice
```
### Verify
```shell
$ forge verify-contract $SAVINGS_VAULT_ADDRESS ./src/SavingsVault.sol:SavingsVault --chain celo-sepolia --verifier blockscout --verifier-api-key $CELOSCAN_API_KEY --verifier-url $CELOSCAN_API_URL
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
