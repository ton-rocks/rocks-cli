# ROCKS-CLI

### Описание
Интерфейс командной строки для работы в сети TON Rocks.

### Сборка
Для сборки проекта используйте команду
```
npm run build
```
В результате получится исполняемый файл rocks-cli

### Использование
```
rocks-cli --help
Usage: rocks-cli <command> [options]

Commands:
  rocks-cli genphrase                       Generate seed phrase
  rocks-cli getkeypair [keyfile] [--seed  "seed_phrase"]    Generate keypair from seed phrase or new
  rocks-cli block [{blockid}]               Get block with "block id" or latest
  rocks-cli getconfig <index|all>           Get global config
  rocks-cli account <{address}>             Get account state
  rocks-cli transaction <{transactionid}>   Get transaction
  rocks-cli giver <{address}>  [--giver-address <{address}>]   Get 10 tokens for free
  rocks-cli genaddr <tvc> <abi> <params> [header] [--genkey  <keyfile.json>|--setkey <keyfile.json>]  [--wc <int8>]    Generate Contract Address
  rocks-cli deploy <tvc> <abi> <params>  [header] [--sign <keyfile>] [--wc <int8>]     Deploy Contract
  rocks-cli call <{address}> <method> <params> [header] [--abi <abi_file>]  [--sign <keyfile>]       Call Method
  rocks-cli runget <{address}> <method>  [<params>...]     Run funC get-method
  rocks-cli message <{address}> <method>
  <params> [--abi <abi_file>] [--sign  <keyfile>] [--lifetime <seconds>]  [--raw] [--output <file_name>]    Generate signed message
  rocks-cli send <message>             Send raw boc message (base64 string)
  rocks-cli sendfile <msg_file>         Send raw boc message from file

Ids format:
  --{blockid} - {workchain_dec:shard_hex:lt_dec:root_hash_hex:file_hash_hex}
  --{transactionid} - {workchain_dec:account_address_hex:transaction_lt_dec:transaction_hash_hex}

Options:
  --version             Show version number                            [boolean]
  --network             Network global config or alias [default: "RocksTestnet"]
  --storage <filename>  Use filename for storage           [default: ".storage"]
  --log <filename>      Log to file
  --verbose             Print logs to stdout
  --help                Show help                                      [boolean]
```
