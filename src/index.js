var argv = require('yargs')
    .usage('Usage: $0 <command> [options]')
    .option('network', {
        describe: 'Network global config or alias',
        default: 'RocksTestnet'
      })
    .option('storage <filename>', {
        describe: 'Use filename for storage',
        default: '.storage'
      })
    .option('log <filename>', {
        describe: 'Log to file'
      })
    .option('verbose', {
        describe: 'Print logs to stdout'
      })

    .command('genphrase', 'Generate seed phrase')
    .command('getkeypair [keyfile] [--seed "seed_phrase"]', 'Generate keypair from seed phrase or new')

    .command('block [{blockid}]', 'Get block with "block id" or latest')
    .command('getconfig <index|all>', 'Get global config')
    .command('account <{address}>', 'Get account state')
    .command('transaction <{transactionid}>', 'Get transaction')

    .command('giver <{address}> [--giver-address <{address}>]', 'Get 10 tokens for free')

    .command('genaddr <tvc> <abi> <params> [header] [--genkey <keyfile.json>|--setkey <keyfile.json>] [--wc <int8>]', 'Generate Contract Address')
    .command('deploy <tvc> <abi> <params> [header] [--sign <keyfile>] [--wc <int8>]', 'Deploy Contract')
    .command('call <{address}> <method> <params> [header] [--abi <abi_file>] [--sign <keyfile>]', 'Call Method')
    .command('runget <{address}> <method> [<params>...]', 'Run funC get-method')
    .command('message <{address}> <method> <params> [--abi <abi_file>] [--sign <keyfile>] [--lifetime <seconds>] [--raw] [--output <file_name>]', 'Generate signed message')
    .command('send <message>', 'Send raw boc message (base64 string)')
    .command('sendfile <msg_file>', 'Send raw boc message from file')
    .demandCommand()

    .group('{blockid} - {workchain_dec:shard_hex:lt_dec:root_hash_hex:file_hash_hex}', 'Ids format:')
    .group('{transactionid} - {workchain_dec:account_address_hex:transaction_lt_dec:transaction_hash_hex}', 'Ids format:')
   // .help('{blockid} - {wc:shard_hex:lt_dec:root_hash_hex:file_hash_hex} - {-1:8000000000000000:458696:7369CBB4E341B9847FB4DA1A0FF035E08BCDB22BB42309B4B82AA725ED6E4E65:E610CB2F0340A9C081A5531B73B2EE9EF13B6ED8119F7010211A8D1C57994745}')
   // .help('{transactionid} - {wc_dec:account_address_hex:transaction_lt_dec:transaction_hash_hex} - {-1:8000000000000000:458696:7369CBB4E341B9847FB4DA1A0FF035E08BCDB22BB42309B4B82AA725ED6E4E65:E610CB2F0340A9C081A5531B73B2EE9EF13B6ED8119F7010211A8D1C57994745}')

    .help('help')
   // .alias('h', 'help')
    .argv;

var fs = require('fs');
var util = require('util');

var trueLog = console.log;
let logger = function() {

  const msg = util.format.apply(this, arguments) + '\n';

  if (argv.log !== undefined && typeof argv.log === 'string') {
    fs.appendFile(argv.log, msg, function(err) {
      if(err) {
        return trueLog(err);
      }
    });
  }
  if (argv.verbose === true) {
    trueLog.apply(this, arguments);
  }
}
console.log = logger;
console.warn = logger;
console.error = logger;

trueLog('argv:', argv);

const commands = require('./commands');

const command = commands[argv._[0]];

if (command === undefined) {
  return;
}


console.log('command', command);

async function main() {
  try {
    let result = await command(argv);
    trueLog(result);
    process.exit(0);
  } catch (e) {
    let res = {
      ok: false,
      reason: e.toString(),
      stack: e.stack
    }
    trueLog(e);
    trueLog(JSON.stringify(res, null, 2));
    process.exit(-1);
  }
}

main();

return;

const TonRocks = require("ton-rocks-js");

var storage;
var rocksTestnet;
var ton;

async function testStartup() {
    // predefined config
    rocksTestnet = TonRocks.configs.RocksTestnet;

    // known blocks & hosts storage
    storage = new TonRocks.storages.DummyStorage(rocksTestnet.zero_state.filehashBase64());
    storage.load();
    storage.addBlock(rocksTestnet.zero_state);

    await TonRocks.Contract.init();

    // connect to lite-server
    const liteClient = new TonRocks.providers.LiteClient(rocksTestnet);
    while (true) {
        const lastBlock = await liteClient.connect();
        if (lastBlock !== undefined) {
            console.log('connected. lastBlock:', lastBlock);
            break;
        }
    }


    // Main API object
    ton = new TonRocks(liteClient, storage);

    return ton;
}


async function testNewKeypair(privateKey)
{
    let seed;

    if (privateKey === undefined) {
        let mnemonic = TonRocks.utils.bip39.generateMnemonic();
        console.log('New mnemonic:', mnemonic);
        console.log('Validate mnemonic:', TonRocks.utils.bip39.validateMnemonic(mnemonic));

        // Convert 12 word mnemonic to 32 byte seed
        seed = await TonRocks.utils.bip39.mnemonicToSeed(mnemonic);
        seed = seed.subarray(0, 32);
    } else {
        seed = TonRocks.utils.hexToBytes(privateKey);
    }
    
    console.log('private key:', TonRocks.utils.bytesToHex(seed));

    const keyPair = TonRocks.utils.nacl.sign.keyPair.fromSeed(seed);
    console.log('keyPair:', keyPair);

    return keyPair;
}

function assert(expr) {
    if (!expr)  {
        console.assert(expr);
        debugger;
    }
}

//var fs = require('fs');

//eval(fs.readFileSync('../dist/tonrocks.bundle.js')+'');
//eval(fs.readFileSync('test-common.js')+'');
//eval(fs.readFileSync('test-giver.js')+'');
//eval(fs.readFileSync('test-blockapi.js')+'');
//eval(fs.readFileSync('test-abi.js')+'');
//eval(fs.readFileSync('test-classic.js')+'');

async function test() {
    await testStartup();
    let i = 0;
    while(true) {
        console.log('Start batch number', i);
     //   await testBlockAPI();
        await testAbi();
    //    await testClassic();
        console.log('Finish batch number', i);
        i++;
    }
}

test();




var blockForRef;
/*
file_hash: Uint32Array(8) [658838343, 695902356, 1428720169, 1424633489, 1018050317, 492063929, 3685580618, 4025113653]
root_hash: Uint32Array(8) [3148955710, 1943225654, 1054771022, 1370635331, 2019297237, 2620190021, 133850716, 4155409007]
seqno: 157958
shard: BN {negative: 0, words: Array(3), length: 3, red: null}
workchain: -1
*/

async function testBlockAPI()
{
    console.log('BlockAPI test start');

    // Block api object
    let blockAPI = new TonRocks.bc.Block();

    // get latest block
    let blockId = await blockAPI.callMethod(10, () => blockAPI.getLatestId());
    console.log('latestBlockId', blockId);
    assert(blockId.ok);

    // validate latest block
    let latestBlockValid = await blockAPI.callMethod(10, () => blockAPI.validate(blockId.id));
    console.log('latestBlockValid', latestBlockValid);
    assert(latestBlockValid.ok && latestBlockValid.valid);

    // get block header
    let blockHeader = await blockAPI.callMethod(10, () => blockAPI.getHeader(blockId.id));
    console.log('blockHeader', blockHeader);
    assert(blockHeader.ok && blockHeader.blockHeader);

    // get full block data
    let blockData = await blockAPI.callMethod(10, () => blockAPI.getData(blockId.id));
    console.log('blockData', blockData);
    assert(blockData.ok && blockData.block);

    // get block shards
    let shards = await blockAPI.callMethod(10, () => blockAPI.getShards(blockId.id));
    console.log('shards', shards);
    assert(shards.ok && shards.shardHashes);

    blockForRef = {
        file_hash: blockId.id.file_hash,
        root_hash: blockId.id.root_hash,
        seqno: blockId.id.seqno,
        start_lt: blockData.block.info.start_lt,
        end_lt: blockData.block.info.end_lt,
        utime: blockData.block.info.gen_utime
    };

    await testConfigs(blockAPI, blockId);
    await testBlockSearch(blockAPI);
    await testRemoteSmc(blockAPI, blockId);
    await testAccounts(blockAPI, blockId);
    await testProofs(blockAPI);

    console.log('BlockAPI test done');
}

async function testConfigs(blockAPI, blockId)
{
    // get existing config
    let config34 = await blockAPI.callMethod(10, () => blockAPI.getConfig(blockId.id, 34));
    console.log('config34', config34);
    assert(config34.ok && config34.configParam);

    // get nonexisting config
    let config80 = await blockAPI.callMethod(10, () => blockAPI.getConfig(blockId.id, 80));
    console.log('config80', config80);
    assert(config80.ok && !config80.configParam);

    // get all configs
    let configAll = await blockAPI.callMethod(10, () => blockAPI.getConfig(blockId.id));
    console.log('configAll', configAll);
    assert(configAll.ok && configAll.configParams);
}

async function testGetElectorAddr(blockAPI, blockId)
{
    // get elector address
    let config1 = await blockAPI.callMethod(10, () => blockAPI.getConfig(blockId.id, 1));
    console.log('config1', config1);
    assert(config1.ok && config1.configParam);

    const electorAddr = '-1:' + TonRocks.utils.bytesToHex(config1.configParam.elector_addr);
    console.log('electorAddr', electorAddr);
    assert(electorAddr === '-1:3333333333333333333333333333333333333333333333333333333333333333');

    return electorAddr;
}


async function testAccounts(blockAPI, blockId)
{
    const addr = await testGetElectorAddr(blockAPI, blockId);

    // get nonexisting account state (basechain)
    let account = await blockAPI.callMethod(10, () => blockAPI.getAccountState(blockId.id, '0:003d8af297b8a29f86360fa4012b8cc1e9f5748003744a1d3a5bb966c6213f00'));
    console.log('account nonexisting basechain', account);
    assert(account.ok && account.account.type === 'none');

    // get nonexisting account state (masterchain)
    account = await blockAPI.callMethod(10, () => blockAPI.getAccountState(blockId.id, '-1:003d8af297b8a29f86360fa4012b8cc1e9f5748003744a1d3a5bb966c6213f00'));
    console.log('account nonexisting basechain', account);
    assert(account.ok && account.account.type === 'none');

    // get existing account state
    account = await blockAPI.callMethod(10, () => blockAPI.getAccountState(blockId.id, addr));
    console.log('account existing', account);
    assert(account.ok && account.account.type !== 'none');

    // get transactions list (5)
    let transactions = await blockAPI.callMethod(10, () => blockAPI.getTransactions(5, addr, account.lastTransLt, account.lastTransHash));
    console.log('account transactions', transactions);
    assert(transactions.ok && transactions.transactionList.length === 5);
    let lastT = transactions.transactionList[transactions.transactionList.length-1];

    // get transactions list (next 12)
    transactions = await blockAPI.callMethod(10, () => blockAPI.getTransactions(12, addr, lastT.prev_trans_lt, lastT.prev_trans_hash));
    console.log('account transactions', transactions);
    assert(transactions.ok && transactions.transactionList.length === 12);
    lastT = transactions.transactionList[transactions.transactionList.length-1];

    // get transactions list (next 1)
    transactions = await blockAPI.callMethod(10, () => blockAPI.getTransactions(1, addr, lastT.prev_trans_lt, lastT.prev_trans_hash));
    console.log('account transactions', transactions);
    assert(transactions.ok && transactions.transactionList.length === 1);
    lastT = transactions.transactionList[transactions.transactionList.length-1];

    // get transactions list (next 10)
    transactions = await blockAPI.callMethod(10, () => blockAPI.getTransactions(10, addr, lastT.prev_trans_lt, lastT.prev_trans_hash));
    console.log('account transactions', transactions);
    assert(transactions.ok && transactions.transactionList.length === 10);
    lastT = transactions.transactionList[transactions.transactionList.length-1];

    // get transactions list (next 101)
    transactions = await blockAPI.callMethod(10, () => blockAPI.getTransactions(101, addr, lastT.prev_trans_lt, lastT.prev_trans_hash));
    console.log('account transactions', transactions);
    assert(transactions.ok && transactions.transactionList.length === 101);
    lastT = transactions.transactionList[transactions.transactionList.length-1];

    // get transactions list (next 202)
    transactions = await blockAPI.callMethod(10, () => blockAPI.getTransactions(202, addr, lastT.prev_trans_lt, lastT.prev_trans_hash));
    console.log('account transactions', transactions);
    assert(transactions.ok && transactions.transactionList.length === 202);
    lastT = transactions.transactionList[transactions.transactionList.length-1];

    // get transactions list (next 2000)
    for (let i = 0; i < 2; i++) {
        transactions = await blockAPI.callMethod(10, () => blockAPI.getTransactions(1000, addr, lastT.prev_trans_lt, lastT.prev_trans_hash));
        console.log('account transactions', transactions);
        assert(transactions.ok && transactions.transactionList.length > 0);
        lastT = transactions.transactionList[transactions.transactionList.length-1];
    }
}

async function testBlockSearch(blockAPI)
{
    // lookup by seqno
    let blockId = new TonRocks.bc.BlockId({
        workchain: -1,
        shard: new TonRocks.utils.BN("8000000000000000", 16),
        seqno: blockForRef.seqno
    });
    blockId = await blockAPI.callMethod(10, () => blockAPI.lookup(blockId));
    console.log('lookup block by seqno', blockId);
    assert(blockId.ok && blockId.id.seqno === blockForRef.seqno);

    // lookup by utime
    blockId = new TonRocks.bc.BlockId({
        workchain: -1,
        shard: new TonRocks.utils.BN("8000000000000000", 16)
    });
    blockId = await blockAPI.callMethod(10, () => blockAPI.lookup(blockId, undefined, blockForRef.utime));
    console.log('lookup block by utime', blockId);
    assert(blockId.ok && blockId.id.seqno === blockForRef.seqno);

    // lookup by lt (start_lt)
    blockId = new TonRocks.bc.BlockId({
        workchain: -1,
        shard: new TonRocks.utils.BN("8000000000000000", 16)
    });
    blockId = await blockAPI.callMethod(10, () => blockAPI.lookup(blockId, blockForRef.start_lt));
    console.log('lookup block by lt', blockId);
    assert(blockId.ok && blockId.id.seqno === blockForRef.seqno);

    // lookup by lt (end_lt)
    blockId = new TonRocks.bc.BlockId({
        workchain: -1,
        shard: new TonRocks.utils.BN("8000000000000000", 16)
    });
    blockId = await blockAPI.callMethod(10, () => blockAPI.lookup(blockId, blockForRef.end_lt));
    console.log('lookup block by lt', blockId);
    assert(blockId.ok && blockId.id.seqno === blockForRef.seqno);
}

async function testProofs(blockAPI)
{
    // check backward proof
    storage.clear();

    // get latest block
    let blockId = await blockAPI.callMethod(10, () => blockAPI.getLatestId());
    console.log('latestBlockId', blockId);
    assert(blockId.ok);

    if (!blockId.ok)
        return;

    storage.addBlock(blockId.id);

    // validate block
    const blockValid = await blockAPI.callMethod(10, () => blockAPI.validate(rocksTestnet.zero_state));
    console.log('zerostate blockValid', blockValid);
    assert(blockValid.ok && blockValid.valid);
    
    storage.clear();

    storage.addBlock(rocksTestnet.zero_state);

    // get latest block
    blockId = await blockAPI.callMethod(10, () => blockAPI.getLatestId());
    console.log('latestBlockId', blockId);
    assert(blockId.ok);

    // forward proof
    let latestBlockValid = await blockAPI.callMethod(10, () => blockAPI.validate(blockId.id));
    console.log('latestBlockValid', latestBlockValid);
    assert(latestBlockValid.ok && latestBlockValid.valid);
}


async function testRemoteSmc(blockAPI, blockId)
{
    // contracts test

    const electorAddr = await testGetElectorAddr(blockAPI, blockId);

    // REMOTE: get elector account state
    let params = new TonRocks.types.Cell();
    params.bits.writeBytes(new Uint8Array(3));
    let paramBoc = await params.toBoc(false, false, false);
    console.log(params, paramBoc);
    let res = await blockAPI.callMethod(10, () => blockAPI.runSmcMethod(blockId.id, electorAddr, 'participant_list', paramBoc));
    console.log('elector participant_list', res);
    assert(res.ok);

    // REMOTE: get elector election id
    res = await blockAPI.callMethod(10, () => blockAPI.runSmcMethod(blockId.id, electorAddr, 'active_election_id', paramBoc));
    console.log('elector active_election_id', res);
    assert(res.ok);
}

var giverAddress = "0:9a66a943e121e1cdb8e09126d3d31a88ac1e4b6d391bc0718b39af36e8de372a";

async function testGiverDeploy()
{
    let address;

    const sm = new TonRocks.AbiContract({
        abiPackage: TonRocks.AbiPackages.Giver,
        keys: TonRocks.utils.nacl.sign.keyPair()
    });

    const smDeploy = await sm.deploy({
        wc: 0,
        input: {},
        header: undefined,
        init: undefined
    });

    const smAddress = smDeploy.getAddress();
    console.log('smAddress', smAddress.toString());
    address = smAddress;

    console.log('Wait for account init:', smAddress.toString());

    await (new Promise(resolve => setTimeout(resolve, 10000)));

    while (true) {
        try {
            const smAccount = await sm.getAccount();
            console.log('Account state:', smAccount);
            if (smAccount.type !== TonRocks.Contract.AccountType.none)
                break;
        } catch (e) {
            console.log('Error:', e);
        }
        await (new Promise(resolve => setTimeout(resolve, 10000)));
    }

    while (true) {
        const smDeployResult = await smDeploy.run();
        console.log('smDeployResult', smDeployResult);
        if (smDeployResult.ok)
            break;

        await (new Promise(resolve => setTimeout(resolve, 10000)));
    }


    const smGetCounter = sm.methods.getCounter();

    const smGetCounterLocalResult = await smGetCounter.runLocal();
    console.log('smGetCounterLocalResult', smGetCounterLocalResult);

    // test giver with 10 grams
    const smTransferToAddress = sm.methods.transferToAddress({
        input: {"destination":address.toString(false),"amount":10000000000},
        header: undefined
    });

    while (true) {
        const smTransferToAddressResult = await smTransferToAddress.run();
        console.log('smTransferToAddressResult', smTransferToAddressResult);
        if (smTransferToAddressResult.ok)
            break;

        await (new Promise(resolve => setTimeout(resolve, 10000)));
    }

    const smGetCounterLocalResult2 = await smGetCounter.runLocal();
    console.log('smGetCounterLocalResult2', smGetCounterLocalResult2);

    const smTransactionsAll = await sm.getTransactions();
    console.log('smTransactionsAll', smTransactionsAll);

    console.log('Giver test done. Your giver address: ' + address.toString(false));

    giverAddress = address.toString(false);

    return address;
}


async function testGiverGimme(address, amount)
{
    console.log('Asking giver for', amount, 'to', address.toString(false));

    const sm = new TonRocks.AbiContract({
        abiPackage: TonRocks.AbiPackages.Giver,
        address: giverAddress
    });

    const smTransferToAddress = sm.methods.do_tvm_transfer({
        input: {"remote_addr": address.toString(false), "grams_value": amount, "bounce": false, "sendrawmsg_flag": 0},
        header: undefined
    });

    while (true) {
        const smTransferToAddressResult = await smTransferToAddress.run();
        console.log('smTransferToAddressResult', smTransferToAddressResult);
        if (smTransferToAddressResult.ok) {
            console.log('Giver was happy to help');
            break;
        }

        await (new Promise(resolve => setTimeout(resolve, 10000)));
    }

    const smAccount = await sm.getAccount();
    console.log('Giver balance:', TonRocks.utils.fromNano(smAccount.balance));
}


async function testAbi() {
    console.log('ContractABI test start');

    let keyPair = await testNewKeypair();

    let address = await testAbiDeploy(keyPair);

    let transactions = await testAbiTransact(address, keyPair, 8);

    await testAbiGetMethods(address, transactions);

    console.log('ContractABI test done');
}

async function testAbiDeploy(keyPair)
{
    let address;

    const sm = new TonRocks.AbiContract({
        abiPackage: TonRocks.AbiPackages.SetcodeMultisigWallet,
        keys: keyPair
    });

    const smDeploy = await sm.deploy({
        wc: -1,
        input: {"owners":["0x" + TonRocks.utils.bytesToHex(keyPair.publicKey)], "reqConfirms":1},
        header: undefined,
        init: undefined
    });
    const smAddress = smDeploy.getAddress();
    console.log('smAddress', smAddress.toString());
    address = smAddress;

    const smDeployMessage = await smDeploy.getMessage();
    console.log('smDeployMessage', smDeployMessage);
    assert(smDeployMessage.messageBodyBase64);

    const smDeployFee = await smDeploy.estimateFee();
    console.log('smDeployFee', smDeployFee);
    assert(smDeployFee.totalAccountFees.gt(1000));

    const smDeployLocal = await smDeploy.runLocal();
    console.log('smDeployLocal', smDeployLocal);
    assert(smDeployLocal.account.code && smDeployLocal.account.data);

    console.log('Wait for account init:', smAddress.toString());

    await testGiverGimme(smAddress, 10000000000);

    while (true) {
        try {
            const smAccount = await sm.getAccount();
            console.log('Account state:', smAccount);
            if (smAccount.type !== TonRocks.Contract.AccountType.none)
                break;
        } catch (e) {
            console.log('Error:', e);
        }
        await (new Promise(resolve => setTimeout(resolve, 10000)));
    }

    while (true) {
        const smDeployResult = await smDeploy.run();
        console.log('smDeployResult', smDeployResult);
        if (smDeployResult.ok) {
            assert(smDeployResult.sended && smDeployResult.confirmed);
            break;
        }

        await (new Promise(resolve => setTimeout(resolve, 10000)));
    }

    return address;
}

async function testAbiTransact(address, keyPair, transactionNum)
{
    const sm = new TonRocks.AbiContract({
        abiPackage: TonRocks.AbiPackages.SetcodeMultisigWallet,
        address,
        keys: keyPair
    });

    const smSubmitTransaction = sm.methods.submitTransaction({
        input: {"dest":giverAddress,"value":1000000000,"bounce":true,"allBalance":false,"payload":"te6ccgEBAQEAAgAAAA=="},
        header: undefined
    });
    const smSubmitTransactionMessage = await smSubmitTransaction.getMessage();
    console.log('smSubmitTransactionMessage', smSubmitTransactionMessage);
    assert(smSubmitTransactionMessage.messageBodyBase64);

    const smSubmitTransactionFee = await smSubmitTransaction.estimateFee();
    console.log('smSubmitTransactionFee', smSubmitTransactionFee);
    assert(smSubmitTransactionFee.totalAccountFees.gt(1000));

    const smSubmitTransactionLocalResult = await smSubmitTransaction.runLocal({
        fullRun: true
    });
    console.log('smSubmitTransactionLocalResult', smSubmitTransactionLocalResult);
    assert(smSubmitTransactionLocalResult.account.code && smSubmitTransactionLocalResult.account.data);

    let success = 0;
    for (let i = 0; i < transactionNum; i++) {
        const smSubmitTransactionResult = await smSubmitTransaction.run();
        console.log('smSubmitTransactionResult', i, smSubmitTransactionResult);
        if (smSubmitTransactionResult.ok) success++;
    }
    assert(success > 0);

    const smTransactionsAll = await sm.getTransactions();
    console.log('smTransactionsAll', smTransactionsAll);
    assert(smTransactionsAll.length === success + 2); // trans + initial + deploy

    return success;
}

async function testAbiGetMethods(address, transactions)
{
    address = new TonRocks.types.Address(address);

    const sm = new TonRocks.AbiContract({
        abiPackage: TonRocks.AbiPackages.SetcodeMultisigWallet,
        address: address.toString(false)
    });

    // base contract methods (exists in all contracts)

    const smAddress = sm.getAddress();
    console.log('smAddress', smAddress);

    const smAccount = await sm.getAccount();
    console.log('smAccount', smAccount);

    const smTransactionsAll = await sm.getTransactions();
    console.log('smTransactionsAll', smTransactionsAll);
    assert(smTransactionsAll.length === transactions + 2);

    const smTransactions3 = await sm.getTransactions(undefined, undefined, 3);
    console.log('smTransactions3', smTransactions3);
    assert(smTransactions3.length === 3);

    const smTransactionsFrom = await sm.getTransactions(smTransactions3[smTransactions3.length-1].prev_trans_id);
    console.log('smTransactionsFrom', smTransactionsFrom);
    assert(smTransactionsFrom.length === transactions + 2 - 3 &&
        TonRocks.utils.compareBytes(smTransactionsFrom[0].hash, smTransactions3[smTransactions3.length-1].prev_trans_id.hash));

    // get methods (contract specific)

    const smGetCustodians = sm.methods.getCustodians();

    const smGetCustodiansLocalResult = await smGetCustodians.runLocal();
    console.log('smGetCustodiansLocalResult', smGetCustodiansLocalResult);
    assert(smGetCustodiansLocalResult.output.custodians.length === 1);

    const smGetParameters = sm.methods.getParameters();

    const smGetParametersLocalResult = await smGetParameters.runLocal();
    console.log('smGetParametersLocalResult', smGetParametersLocalResult);
    assert(smGetParametersLocalResult.output.requiredTxnConfirms === '0x1');

}

