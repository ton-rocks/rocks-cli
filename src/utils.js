const TonRocks = require("ton-rocks-js");
const TvmClient = require("ton-rocks-js/src/tvm/nodejs/TvmClient");
const fs = require('fs').promises;

async function rocksInitConfig(argv) {

    let network = argv.network;

    if (TonRocks.configs[network] !== undefined) {
        return TonRocks.configs[network];
    }

    const data = await fs.readFile(network, "utf8");
    const json = JSON.parse(data);

    if (!json.validator) {
        throw Error('No zerostate in network config');
    }
    if (json.validator.zero_state) {
        json.validator.zero_state.shard = "8000000000000000";
    }
    if (json.validator.init_block) {
        json.validator.init_block.shard = "8000000000000000";
    }

    return json;
}

async function rocksInitStorage(network, argv) {

    let storage_file = argv.storage;

    let storage = new TonRocks.storages.DummyStorage(network.zero_state.filehashBase64());
    storage.load();
    storage.addBlock(network.zero_state);

    return storage;
}

async function rocksInitSMC(argv) {
    await TonRocks.Contract.init();
}

async function rocksInitClient(network, argv) {
    return new TonRocks.providers.LiteClient(network);
}

async function rocksConnect(client, argv) {
    while (true) {
        const lastBlock = await client.connect();
        if (lastBlock !== undefined) {
            console.log('connected. lastBlock:', lastBlock);
            return lastBlock;
        }
    }
}

async function rocksInit(client, storage, argv) {
    return new TonRocks(client, storage);
}

async function stringifyObject(obj) {
  let ret = {};
  for (let i in obj) {
    if (typeof obj[i] === 'undefined') {
      continue;
    }
    else if (typeof obj[i] === 'object') {
      if (obj[i] instanceof TonRocks.types.Address) {
        ret[i] = obj[i].toString(false);
      }
      else if (obj[i] instanceof TonRocks.utils.BN) {
        ret[i] = obj[i].toString(16);
      }
      else if (obj[i] instanceof Uint8Array) {
        ret[i] = TonRocks.utils.bytesToHex(obj[i]);
      }
      else if (obj[i] instanceof Uint16Array || obj[i] instanceof Uint32Array) {
        ret[i] = TonRocks.utils.bytesToHex(new Uint8Array(obj[i].buffer));
      }
      else if (obj[i] instanceof TonRocks.types.Hashmap ||
          obj[i] instanceof TonRocks.types.HashmapE ||
          obj[i] instanceof TonRocks.types.HashmapAug ||
          obj[i] instanceof TonRocks.types.HashmapAugE) {
        ret[i] = await obj[i].stringify(stringifyObject);
      } else {
        ret[i] = await stringifyObject(obj[i]);
      }
    }
    else {
      ret[i] = obj[i];
    }
  }
  return ret;
}

async function loadAbi(abi) {

  const data = await fs.readFile(abi, "utf8");
  const json = JSON.parse(data);
  return json;

}

async function loadTvc(tvc) {

  const data = await fs.readFile(tvc);
  const b64 = TonRocks.utils.bytesToBase64(new Uint8Array(data));
  return b64;

}

function makePackage(abi, tvc) {
  const p = {
    abi: abi,
    imageBase64: tvc
  };
  return p;
}

async function loadKeyfile(path) {

  const data = await fs.readFile(path, "utf8");
  const json = JSON.parse(data);
  return json;

}

module.exports = {
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
  loadKeyfile
};