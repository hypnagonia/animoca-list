const { Harmony } = require("@harmony-js/core");
const axios = require("axios");
const { HttpProvider, Messenger } = require("@harmony-js/network");
const {
  ChainID,
  ChainType
} = require("@harmony-js/utils");
const json = require("./ABI.json");
const saleABI = require("./ABI2.json");

//const url = "https://api.s0.b.hmny.io";
const url = "https://api0.s0.t.hmny.io";
const hmy = new Harmony(
  url,
//'https://api0.s0.t.hmny.io',
  {
    chainType: ChainType.Harmony,
    chainId: ChainID.HmyMainnet//ChainID.HmyTestnet
  });

(async () => {

  const Web3 = require("web3");

  const tokens = new Set();

  const addrHex = hmy.crypto.getAddress("0xd45f2890afc159f96702de015b414c7d1cda3dba").checksum;

  console.log(addrHex);

  let ethMultiSigContract = hmy.contracts.createContract(json.abi, addrHex);

  let res = await hmy.blockchain.getBlockNumber();

  let logsMessenger = new Messenger(new HttpProvider(url));

  const topicAddress = ethMultiSigContract.abiModel.getEvent("Transfer").signature;

  let latest = Number(res.result);
  let logs = [];
  const interval = 100000;

  // todo set start block
  while (latest > 7812029) {
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
  }

  const web3 = new Web3(url);

  const decoded = logs.map(lastLog => ({
      ...web3.eth.abi.decodeLog(
        ethMultiSigContract.abiModel.getEvent("Transfer").inputs,
        lastLog.data,
        lastLog.topics.slice(1)),
      blockNumber: Number(lastLog.blockNumber, 16)
    })
  );

  const getLastBlock = tokenIds => {
    return decoded.reduce((a, b) => {
      if (!tokenIds.includes(b.tokenId)) {
        return a;
      }
      return a > b.blockNumber ? a : b.blockNumber;
    }, 0);
  };

  decoded.forEach(t => {
    tokens.add(t.tokenId);
  });

  console.log('Total',decoded.length);

  const users = {};
  const tokensWithInfo = [];
  let index = 1;
  for (let t of tokens) {
    console.log(index++, t);
    const uri = await ethMultiSigContract.methods.tokenURI(t).call();
    const owner = await ethMultiSigContract.methods.ownerOf(t).call();
    const playerID = await ethMultiSigContract.methods.playerIdByToken(t).call();

    const meta = await axios.get(uri).then(r => r.data);

    tokensWithInfo.push({
      playerID,
      owner: hmy.crypto.toBech32(owner),
      tokenId: t,
      image: meta.image
    });

    if (users[playerID + owner]) {
      users[playerID + owner].count++;
      users.tokenIds && users.tokenIds.push(t);
    } else {
      users[playerID + owner] = {
        count: 1,
        playerID,
        owner: hmy.crypto.toBech32(owner),
        tokenIds: [t]
      };
    }
  }

  const usersArr = Object.values(users);
  const csv = usersArr.map(e => `${getLastBlock(e.tokenIds)},${e.owner},${e.playerID},${e.count},${e.count * 2400},${e.count * 730}`);
  const csvString = "latest block #,ONE address,player ID,cards,gems,VIP points\n" + csv.join("\n") + "\n"
    + Date.now() + ",,,,,\n"
    + "Total" + `,,,${usersArr.reduce((a, b) => a + b.count, 0)},,`;
  const fs = require("fs");
  fs.writeFileSync("result.csv", csvString);

  process.exit(0);

})();


