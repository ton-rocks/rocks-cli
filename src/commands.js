const fs = require('fs').promises;
const fssync = require('fs');

const {
  stringifyObject,
  rocksInitConfig,
  rocksInitStorage,
  rocksInitSMC,
  rocksInitClient,
  rocksConnect,
  rocksInit,
  loadAbi,
  loadTvc,
  makePackage,
  loadKeyfile} = require('./utils.js');

async function genphrase(argv) {
  let ton = await rocksInit();

  let mnemonic = ton.utils.bip39.generateMnemonic();
  let valid = ton.utils.bip39.validateMnemonic(mnemonic);
  if (!valid) {
    throw Error('Cannot generate valid mnemonic');
  }
  let res = {
    phrase: mnemonic
  }
  return JSON.stringify(res, null, 2);
}

async function getkeypair(argv) {
  let ton = await rocksInit();

  let keyfile = argv["keyfile"];
  let mnemonic = argv['seed'];

  if (typeof mnemonic !== 'string') {
    mnemonic = ton.utils.bip39.generateMnemonic();
  }

  let valid = ton.utils.bip39.validateMnemonic(mnemonic);
  if (!valid) {
    throw Error('Invalid mnemonic');
  }

  // Convert 12 word mnemonic to 32 byte seed
  let seed = await ton.utils.bip39.mnemonicToSeed(mnemonic);
  seed = seed.subarray(0, 32);
  
  const keyPair = ton.utils.nacl.sign.keyPair.fromSeed(seed);
  let res = {
    phrase: mnemonic,
    public: ton.utils.bytesToHex(keyPair.publicKey),
    secret: ton.utils.bytesToHex(seed),
  }
  let res_json = JSON.stringify(res, null, 2);

  if (keyfile !== undefined) {
    await fs.writeFile(keyfile, res_json);
  }

  return res_json;
}

async function block(argv) {
  let config = await rocksInitConfig(argv);
  let storage = await rocksInitStorage(config, argv);
  let client = await rocksInitClient(config, argv);
  let blockId = await rocksConnect(client, argv);
  let ton = await rocksInit(client, storage);

  let blockarg = argv['{blockid}'].replace('{', '').replace('}', '');

  let blockAPI = new ton.bc.Block();

  if (blockarg === undefined) {
    // validate latest block
    let latestBlockValid = await blockAPI.callMethod(10, () => blockAPI.validate(blockId));
    console.log('latestBlockValid', latestBlockValid);

    if (!latestBlockValid.ok || !latestBlockValid.valid)
      throw latestBlockValid.reason;
  } else {
    let m = blockarg.split(':');
    if (m.length < 3) {
      throw Error('Invalid block id');
    }
    // lookup by seqno
    blockId = new ton.bc.BlockId({
      workchain: (new ton.utils.BN(m[0], 10)).toNumber(),
      shard: new ton.utils.BN(m[1], 16),
      seqno: (new ton.utils.BN(m[2], 10)).toNumber()
    });
    if (m.length === 5) {
      blockId.root_hash = new Uint32Array(ton.utils.hexToBytes(m[3]).buffer);
      blockId.file_hash = new Uint32Array(ton.utils.hexToBytes(m[4]).buffer);
    }
    blockId = await blockAPI.callMethod(10, () => blockAPI.lookup(blockId));
    console.log('lookup block by seqno', blockId);
    if (!blockId.ok) {
      throw Error('Block not found');
    }
    blockId = blockId.id;
    if (m.length > 3) {
      const root_hash = new Uint32Array(ton.utils.hexToBytes(m[3]).buffer);
      const file_hash = new Uint32Array(ton.utils.hexToBytes(m[4]).buffer);
      if ((root_hash !== undefined && !ton.utils.compareBytes(blockId.root_hash, root_hash)) ||
          (file_hash !== undefined && !ton.utils.compareBytes(blockId.file_hash, file_hash))) {
        throw Error('Invalid block hash');
      }
    } else {
      // validate  block
      let blockValid = await blockAPI.callMethod(10, () => blockAPI.validate(blockId));
      console.log('blockValid', blockValid);

      // validation of old block is not guaranteed
      if (!blockValid.ok || blockValid.valid) {
        console.warn('Cannot validate block');
      }
    }
  }

  // get full block data
  let blockData = await blockAPI.callMethod(10, () => blockAPI.getData(blockId));
  console.log('blockData', blockData);
  if (!blockData.ok)
    throw blockData.reason;
  if (!blockData.block)
    throw Error('Cannot get block data');
  
  blockData.block.blockId = blockId;
  blockData.block.id = blockId.workchain.toString() + ':' +
    blockId.shard.toString(16) + ':' + blockId.seqno.toString() + ':' +
    ton.utils.bytesToHex(new Uint8Array(blockId.root_hash.buffer)) + ':' + 
    ton.utils.bytesToHex(new Uint8Array(blockId.file_hash.buffer));

  let res = await stringifyObject(blockData.block);

  return JSON.stringify(res, null, 2);
    
}

async function getconfig(argv) {
  let config = await rocksInitConfig(argv);
  let storage = await rocksInitStorage(config, argv);
  let client = await rocksInitClient(config, argv);
  let blockId = await rocksConnect(client, argv);
  let ton = await rocksInit(client, storage);

  let blockAPI = new ton.bc.Block();

  // validate latest block
  let latestBlockValid = await blockAPI.callMethod(10, () => blockAPI.validate(blockId));
  console.log('latestBlockValid', latestBlockValid);

  if (!latestBlockValid.ok || !latestBlockValid.valid)
    throw latestBlockValid.reason;

  // get config
  let cfg = await blockAPI.callMethod(10, () => blockAPI.getConfig(blockId, argv.index === 'all' ? undefined : argv.index));
  console.log('config', cfg);
  if (!cfg.ok) {
    throw Error('Cannot get config');
  }

  let res = await stringifyObject(argv.index === 'all' ? cfg.configParams : cfg.configParam);

  return JSON.stringify(res, null, 2);
}

async function account(argv) {
  let config = await rocksInitConfig(argv);
  let storage = await rocksInitStorage(config, argv);
  await rocksInitSMC(argv);
  let client = await rocksInitClient(config, argv);
  let blockId = await rocksConnect(client, argv);
  let ton = await rocksInit(client, storage);

  if (argv['{address}'] === undefined)
    throw Error('No account address');

  const addr = argv['{address}'].replace('{', '').replace('}', '');
  const address = new ton.types.Address(addr);

  const sm = new ton.ClassicContract({
    address: address.toString(false)
  });

  const smAccount = await sm.getAccount();
  console.log('smAccount', smAccount);

  smAccount.raw = undefined;

  let res = await stringifyObject(smAccount);

  return JSON.stringify(res, null, 2);
}

async function transaction(argv) {
  let config = await rocksInitConfig(argv);
  let storage = await rocksInitStorage(config, argv);
  await rocksInitSMC(argv);
  let client = await rocksInitClient(config, argv);
  let blockId = await rocksConnect(client, argv);
  let ton = await rocksInit(client, storage);

  if (argv['{transactionid}'] === undefined)
    throw Error('No transaction id');
  
  let trans = argv['{transactionid}'].replace('{', '').replace('}', '');

  let m = trans.split(':');
  if (m.length !== 4)
    throw Error('Invalid transaction id');

  address = new ton.types.Address(m[0] + ':' + m[1]);

  const sm = new ton.ClassicContract({
    address: address.toString(false)
  });

  const tid = {
    lt: new ton.utils.BN(m[2], 10),
    hash: ton.utils.hexToBytes(m[3])
  };

  let smTransaction = await sm.getTransactions(tid, undefined, 1);
  console.log('smTransaction', smTransaction);
  if (smTransaction.length === 0) {
    throw Error('Transaction not found');
  }

  smTransaction = smTransaction[0];
  smTransaction.raw = undefined;
  if (smTransaction.in_msg) smTransaction.in_msg.raw = undefined;
  for (let i in smTransaction.out_msgs) {
    smTransaction.out_msgs[i].raw = undefined;
  }

  let res = await stringifyObject(smTransaction);

  return JSON.stringify(res, null, 2);
}


var giverDefaultAddress = "0:9a66a943e121e1cdb8e09126d3d31a88ac1e4b6d391bc0718b39af36e8de372a";

async function giver(argv) {
  let config = await rocksInitConfig(argv);
  let storage = await rocksInitStorage(config, argv);
  await rocksInitSMC(argv);
  let client = await rocksInitClient(config, argv);
  let blockId = await rocksConnect(client, argv);
  let ton = await rocksInit(client, storage);

  if (argv['{address}'] === undefined)
    throw Error('No account address');

  const addr = argv['{address}'].replace('{', '').replace('}', '');
  const address = new ton.types.Address(addr);

  let giverAddress = giverDefaultAddress;
  if (argv['giver-address'] !== undefined) {
    const gaddr = argv['giver-address'].replace('{', '').replace('}', '');
    giverAddress = (new ton.types.Address(gaddr)).toString(false);
  }

  const amount = 10000000000;

  console.log('Asking giver for', amount, 'to', address.toString(false));

  const sm = new ton.AbiContract({
      abiPackage: ton.AbiPackages.Giver,
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

      await (new Promise(resolve => setTimeout(resolve, 2000)));
  }

  res = {
    ok: true,
    address: address.toString(false),
    amount: amount
  };
  return JSON.stringify(res, null, 2);

}

async function genaddr(argv) {
  let config = await rocksInitConfig(argv);
  let storage = await rocksInitStorage(config, argv);
  await rocksInitSMC(argv);
  let client = await rocksInitClient(config, argv);
  let blockId = await rocksConnect(client, argv);
  let ton = await rocksInit(client, storage);

  const abi = await loadAbi(argv.abi);
  const tvc = await loadTvc(argv.tvc);
  const package = makePackage(abi, tvc);

  let mnemonic;
  let keyPair;
  if (argv.genkey !== undefined) {
    mnemonic = ton.utils.bip39.generateMnemonic();
    let valid = ton.utils.bip39.validateMnemonic(mnemonic);
    if (!valid) {
      throw Error('Cannot generate valid mnemonic');
    }
  } else if (argv.setkey !== undefined) {
    if (fssync.existsSync(argv.setkey)) {
      const data = await loadKeyfile(argv.setkey);
      const seed = ton.utils.hexToBytes(data.secret);
      const public = ton.utils.hexToBytes(data.public);
      keyPair = ton.utils.nacl.sign.keyPair.fromSeed(seed);
      if (!ton.utils.compareBytes(public, keyPair.publicKey)) {
        throw Error('Invalid keyfile');
      }
    } else if (argv.setkey.split(' ').length === 12) {
      mnemonic = argv.setkey;
    }
  } 
  if (mnemonic === undefined && keyPair === undefined) {
    throw Error('no keys');
  }
  if (keyPair === undefined) {
    let seed = await ton.utils.bip39.mnemonicToSeed(mnemonic);
    seed = seed.subarray(0, 32);
    keyPair = ton.utils.nacl.sign.keyPair.fromSeed(seed);
    if (argv.genkey) {
      let res = {
        phrase: mnemonic,
        public: ton.utils.bytesToHex(keyPair.publicKey),
        secret: ton.utils.bytesToHex(seed),
      }
      let res_json = JSON.stringify(res, null, 2);
      await fs.writeFile(argv.genkey, res_json);
    }
  }

  const sm = new ton.AbiContract({
    abiPackage: package,
    keys: keyPair
  });

  let input = argv.params;
  if (input !== undefined) {
    input = JSON.parse(input);
  }

  let header = argv.header;
  if (header !== undefined) {
    header = JSON.parse(header);
  }

  const smDeploy = await sm.deploy({
    wc: argv.wc === undefined ? 0 : argv.wc,
    input: input || {},
    header: header,
    init: undefined
  });

  const smAddress = smDeploy.getAddress();
  console.log('smAddress', smAddress.toString());
  
  const res = {
    address_hex: smAddress.toString(false),
    address_bounceable: smAddress.toString(true, true, true, false),
    address_non_bounceable: smAddress.toString(true, true, false, false)
  }

  return JSON.stringify(res, null, 2);
}

async function deploy(argv) {
  let config = await rocksInitConfig(argv);
  let storage = await rocksInitStorage(config, argv);
  await rocksInitSMC(argv);
  let client = await rocksInitClient(config, argv);
  let blockId = await rocksConnect(client, argv);
  let ton = await rocksInit(client, storage);

  const abi = await loadAbi(argv.abi);
  const tvc = await loadTvc(argv.tvc);
  const package = makePackage(abi, tvc);

  if (argv.sign === undefined) {
    throw Error('no keys');
  }

  let mnemonic;
  let keyPair;

  if (fssync.existsSync(argv.sign)) {
    const data = await loadKeyfile(argv.sign);
    const seed = ton.utils.hexToBytes(data.secret);
    const public = ton.utils.hexToBytes(data.public);
    keyPair = ton.utils.nacl.sign.keyPair.fromSeed(seed);
    if (!ton.utils.compareBytes(public, keyPair.publicKey)) {
      throw Error('Invalid keyfile');
    }
  } else if (argv.sign.split(' ').length === 12) {
    mnemonic = argv.sign;
  }

  if (mnemonic === undefined && keyPair === undefined) {
    throw Error('no keys');
  }

  if (keyPair === undefined) {
    let seed = await ton.utils.bip39.mnemonicToSeed(mnemonic);
    seed = seed.subarray(0, 32);
    keyPair = ton.utils.nacl.sign.keyPair.fromSeed(seed);
  }

  const sm = new ton.AbiContract({
    abiPackage: package,
    keys: keyPair
  });

  let input = argv.params;
  if (input !== undefined) {
    input = JSON.parse(input);
  }

  let header = argv.header;
  if (header !== undefined) {
    header = JSON.parse(header);
  }

  const smDeploy = await sm.deploy({
    wc: argv.wc === undefined ? 0 : argv.wc,
    input: input || {},
    header: header,
    init: undefined
  });

  const smAddress = smDeploy.getAddress();
  console.log('smAddress', smAddress.toString());
  
  let smDeployResult;
  while (true) {
    smDeployResult = await smDeploy.run();
    console.log('smDeployResult', smDeployResult);
    if (smDeployResult.ok) {
        break;
    }

    await (new Promise(resolve => setTimeout(resolve, 2000)));
  }

  const res = {
    ok: smDeployResult.ok,
    sended: smDeployResult.sended,
    confirmed: smDeployResult.confirmed,
    address: smAddress.toString(false)
  }

  return JSON.stringify(res, null, 2);
}

async function call(argv) {
  let config = await rocksInitConfig(argv);
  let storage = await rocksInitStorage(config, argv);
  await rocksInitSMC(argv);
  let client = await rocksInitClient(config, argv);
  let blockId = await rocksConnect(client, argv);
  let ton = await rocksInit(client, storage);

  if (argv['{address}'] === undefined)
    throw Error('No account address');
  
  const addr = argv['{address}'].replace('{', '').replace('}', '');
  const address = new ton.types.Address(addr);
  
  const abi = await loadAbi(argv.abi);
  const package = makePackage(abi, undefined);

  let mnemonic;
  let keyPair;
  if (argv.sign !== undefined) {
    if (fssync.existsSync(argv.sign)) {
      const data = await loadKeyfile(argv.sign);
      const seed = ton.utils.hexToBytes(data.secret);
      const public = ton.utils.hexToBytes(data.public);
      keyPair = ton.utils.nacl.sign.keyPair.fromSeed(seed);
      if (!ton.utils.compareBytes(public, keyPair.publicKey)) {
        throw Error('Invalid keyfile');
      }
    } else if (argv.sign.split(' ').length === 12) {
      mnemonic = argv.sign;
    }
  }

  if (mnemonic !== undefined && keyPair === undefined) {
    let seed = await ton.utils.bip39.mnemonicToSeed(mnemonic);
    seed = seed.subarray(0, 32);
    keyPair = ton.utils.nacl.sign.keyPair.fromSeed(seed);
  }

  const sm = new ton.AbiContract({
    abiPackage: package,
    address,
    keys: keyPair
  });

  let input = argv.params;
  if (input !== undefined) {
    input = JSON.parse(input);
  }

  let header = argv.header;
  if (header !== undefined) {
    header = JSON.parse(header);
  }

  let method = argv.method;
  if (sm.methods[method] === undefined) {
    throw Error('Specified Method not found');
  }

  const smMethod = sm.methods[method]({
    input: input || {},
    header: header
  });

  //const smSubmitTransactionMessage = await smSubmitTransaction.getMessage();
  //console.log('smSubmitTransactionMessage', smSubmitTransactionMessage);
  //assert(smSubmitTransactionMessage.messageBodyBase64);

  let res;

  if (keyPair === undefined) {
    const smLocalResult = await smMethod.runLocal();

    res = {
      output: smLocalResult.output
    }
  } else {
    const smResult = await smMethod.run();

    res = {
      ok: smResult.ok,
      output: smResult.output
    }
  }

  return JSON.stringify(res, null, 2);

}

async function runget(argv) {

}

async function message(argv) {
  let config = await rocksInitConfig(argv);
  let storage = await rocksInitStorage(config, argv);
  await rocksInitSMC(argv);
  let client = await rocksInitClient(config, argv);
  let blockId = await rocksConnect(client, argv);
  let ton = await rocksInit(client, storage);

  if (argv['{address}'] === undefined)
    throw Error('No account address');
  
  const addr = argv['{address}'].replace('{', '').replace('}', '');
  const address = new ton.types.Address(addr);
  
  const abi = await loadAbi(argv.abi);
  const package = makePackage(abi, undefined);

  let mnemonic;
  let keyPair;
  if (argv.sign !== undefined) {
    if (fssync.existsSync(argv.sign)) {
      const data = await loadKeyfile(argv.sign);
      const seed = ton.utils.hexToBytes(data.secret);
      const public = ton.utils.hexToBytes(data.public);
      keyPair = ton.utils.nacl.sign.keyPair.fromSeed(seed);
      if (!ton.utils.compareBytes(public, keyPair.publicKey)) {
        throw Error('Invalid keyfile');
      }
    } else if (argv.sign.split(' ').length === 12) {
      mnemonic = argv.sign;
    }
  }

  if (mnemonic !== undefined && keyPair === undefined) {
    let seed = await ton.utils.bip39.mnemonicToSeed(mnemonic);
    seed = seed.subarray(0, 32);
    keyPair = ton.utils.nacl.sign.keyPair.fromSeed(seed);
  }

  const sm = new ton.AbiContract({
    abiPackage: package,
    address,
    keys: keyPair
  });

  let input = argv.params;
  if (input !== undefined) {
    input = JSON.parse(input);
  }

  let header = argv.header;
  if (header !== undefined) {
    header = JSON.parse(header);
  }

  let method = argv.method;
  if (sm.methods[method] === undefined) {
    throw Error('Specified Method not found');
  }

  const smMethod = sm.methods[method]({
    input: input || {},
    header: header
  });

  const smMethodMessage = await smMethod.getMessage();
  console.log('smMethodMessage', smMethodMessage);

  let res = smMethodMessage;

  return JSON.stringify(res, null, 2);
}

async function send(argv) {
  let config = await rocksInitConfig(argv);
  let storage = await rocksInitStorage(config, argv);
  let client = await rocksInitClient(config, argv);
  let blockId = await rocksConnect(client, argv);
  let ton = await rocksInit(client, storage);

  let message = argv['message'];
  if (message === undefined) {
    throw Error('no message');
  }

  let blockAPI = new ton.bc.Block();
  
  let res = await blockAPI.callMethod(10, () => blockAPI.sendMessage(message));

  return JSON.stringify(res, null, 2);
}

async function sendfile(argv) {
  let config = await rocksInitConfig(argv);
  let storage = await rocksInitStorage(config, argv);
  let client = await rocksInitClient(config, argv);
  let blockId = await rocksConnect(client, argv);
  let ton = await rocksInit(client, storage);

  let msg_file = argv['msg_file'];
  if (msg_file === undefined) {
    throw Error('no message');
  }

  const data = await fs.readFile(msg_file);
  let message = ton.utils.bytesToBase64(new Uint8Array(data));

  let blockAPI = new ton.bc.Block();
  
  let res = await blockAPI.callMethod(10, () => blockAPI.sendMessage(message));

  return JSON.stringify(res, null, 2);
}


module.exports = {
    genphrase,
    getkeypair,
    block,
    getconfig,
    account,
    transaction,
    giver,
    genaddr,
    deploy,
    call,
    runget,
    message,
    send,
    sendfile};