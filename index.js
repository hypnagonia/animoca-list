
(async () => {
  const { Harmony } = require("@harmony-js/core")
  const { HttpProvider, Messenger } = require("@harmony-js/network")
  const {
    ChainID,
    ChainType,
    hexToNumber,
    numberToHex,
    fromWei,
    Units,
    Unit,
  } = require('@harmony-js/utils');

  const Web3 = require('web3')

  const hmy = new Harmony(
    "https://api.s0.b.hmny.io",
    //'https://api0.s0.t.hmny.io',
    {
      chainType: ChainType.Harmony,
      chainId: ChainID.HmyTestnet,
    }
  );

  // process.exit(0)

  const addrHex = hmy.crypto.getAddress("one13wuzxyzgwghkz4l9d3k53lu40gy5yvadyal98r").checksum;

  console.log( addrHex);

  const json = require("./ABI.json");
  let ethMultiSigContract = hmy.contracts.createContract(json.abi, addrHex);

  const begin = Date.now();

  let res = await hmy.blockchain.getBlockNumber();

  let logsMessenger = new Messenger(new HttpProvider("https://api.s0.b.hmny.io"));

  const topicAddress = ethMultiSigContract.abiModel.getEvent("Transfer").signature;

  let latest = Number(res.result);
  let logs = [];
  const interval = 30000;

// while(latest > 0) {
  console.log(latest);

  res = await logsMessenger.send("hmy_getLogs", [
    {
      fromBlock: "0x" + (Math.max(latest - interval, 0)).toString(16),
      toBlock: "0x" + (latest).toString(16),
      address: addrHex,
      topics: [topicAddress]
    }
  ]);

  logs = logs.concat(res.result);

  latest = latest - interval;
//}

  const web3 = new Web3(process.env.ETH_NODE_URL);

  const decoded = logs.map(lastLog => web3.eth.abi.decodeLog(
    ethMultiSigContract.abiModel.getEvent("Transfer").inputs,
    lastLog.data,
    lastLog.topics.slice(1)));

  console.log(decoded);
  console.log("Time: ", (Date.now() - begin) / 1000);
  process.exit(0)
})();

