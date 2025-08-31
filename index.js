const express = require("express");
const bodyParser = require("body-parser");
const { ethers } = require("ethers");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

// -------------------- Setup --------------------
const app = express();
app.use(bodyParser.json());

// local metadata + file store
let records = {}; // { recordId: { filePath, hash, dek, patient } }

// Lisk RPC
const provider = new ethers.JsonRpcProvider("https://rpc.sepolia-api.lisk.com");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Load contract ABIs
const recordAbi = require("./utils/RecordRegistry.json");
const consentAbi = require("./utils/ConsentManager.json");

const consentContract = new ethers.Contract(
  "0xC747737d84EA2393dA88B925F5DC450434708d48",
  consentAbi.abi,
  wallet
);
const recordContract = new ethers.Contract(
  "0x8A5Aac636ae20e285bd1305a70bceCEb6656739E",
  recordAbi.abi,
  wallet
);

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// -------------------- Routes --------------------

// 1. Upload Record
// 1. Upload Record
app.post("/records", async (req, res) => {
  try {
    const { patient, fileContent } = req.body;

    // Encrypt file
    const dek = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", dek, iv);
    const encrypted = Buffer.concat([
      cipher.update(fileContent, "utf8"),
      cipher.final(),
    ]);

    const hash = crypto.createHash("sha256").update(encrypted).digest("hex");

    // Save locally
    const recordId = crypto.randomBytes(16).toString("hex");
    const filePath = path.join(uploadDir, `${recordId}.enc`);
    fs.writeFileSync(filePath, encrypted);

    // Prepare values for contract
    // const recordIdBytes = ethers.hexlify(ethers.randomBytes(32));
    const recordIdBytes32 = "0x" + crypto.randomBytes(32).toString("hex");
    const hashBytes32 = "0x" + hash;
    const cid = path.basename(filePath); // just filename

    // Register on Lisk
    await recordContract.register(recordIdBytes32, hashBytes32, cid);

    // Save metadata locally
    records[recordId] = {
      filePath,
      hash,
      dek: dek.toString("hex"),
      iv: iv.toString("hex"),
      patient,
    };

    res.json({ recordId, filePath, hash });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error uploading record");
  }
});

// app.post("/records", async (req, res) => {
//   try {
//     const { patient, fileContent } = req.body;

//     // Encrypt file with random key (AES)
//     const dek = crypto.randomBytes(32);
//     const iv = crypto.randomBytes(16);
//     const cipher = crypto.createCipheriv("aes-256-gcm", dek, iv);
//     let encrypted = Buffer.concat([
//       cipher.update(fileContent, "utf8"),
//       cipher.final(),
//     ]);

//     const hash = crypto.createHash("sha256").update(encrypted).digest("hex");

//     // Save locally
//     const recordId = crypto.randomBytes(16).toString("hex");
//     const filePath = path.join(uploadDir, `${recordId}.enc`);
//     fs.writeFileSync(filePath, encrypted);

//     // Register on Lisk
//     await recordContract.register(recordId, hash, filePath);

//     // Save metadata locally
//     records[recordId] = {
//       filePath,
//       hash,
//       dek: dek.toString("hex"),
//       iv: iv.toString("hex"),
//       patient,
//     };

//     res.json({ recordId, filePath, hash });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Error uploading record");
//   }
// });

// 2. Grant Consent
app.post("/consents/grant", async (req, res) => {
  try {
    const { doctor, scope, expiry } = req.body;

    const tx = await consentContract.grant(
      doctor,
      ethers.id(scope || "ALL"),
      expiry
    );
    await tx.wait();

    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error granting consent");
  }
});


// 3. Fetch Record (return file + key if allowed)
app.get("/records/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { viewer } = req.query;

    if (!records[id]) return res.status(404).send("Record not found");

    // Check consent on-chain
    const allowed = await consentContract.isAllowed(
      records[id].patient,
      viewer,
      ethers.id("ALL")
    );
    if (!allowed) return res.status(403).send("Access denied");

    res.json({
      filePath: records[id].filePath,
      dek: records[id].dek,
      iv: records[id].iv,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching record");
  }
});

// -------------------- Start --------------------
app.listen(3000, () =>
  console.log("Zephyr backend running on http://localhost:3000")
);


// const express = require("express");
// const bodyParser = require("body-parser");
// const { ethers } = require("ethers");
// const axios = require("axios");
// const crypto = require("crypto");
// const fs = require("fs");
// const dotenv = require("dotenv");
// const { NFTStorage, Blob } = require("nft.storage");  // <-- add this

// dotenv.config();

// // -------------------- Setup --------------------
// const app = express();
// app.use(bodyParser.json());

// // local metadata store (replace later with DB)
// let records = {}; // { recordId: { cid, hash, dek } }

// // NFT.Storage (instead of web3.storage)
// const NFT_STORAGE_TOKEN = process.env.NFT_STORAGE_TOKEN;
// const nftClient = new NFTStorage({ token: NFT_STORAGE_TOKEN });

// // Lisk RPC
// const provider = new ethers.JsonRpcProvider("https://rpc.sepolia-api.lisk.com");
// const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// // Load contract ABIs
// const recordAbi = require("./utils/RecordRegistry.json");
// const consentAbi = require("./utils/ConsentManager.json");

// const consentContract = new ethers.Contract("0xC747737d84EA2393dA88B925F5DC450434708d48", consentAbi.abi, wallet);
// const recordContract = new ethers.Contract("0x8A5Aac636ae20e285bd1305a70bceCEb6656739E", recordAbi.abi, wallet);

// // -------------------- Routes --------------------

// // 1. Upload Record
// app.post("/records", async (req, res) => {
//   try {
//     const { patient, fileContent } = req.body;

//     // Encrypt file with random key (AES)
//     const dek = crypto.randomBytes(32);
//     const cipher = crypto.createCipheriv("aes-256-gcm", dek, Buffer.alloc(16, 0));
//     let encrypted = Buffer.concat([cipher.update(fileContent, "utf8"), cipher.final()]);
//     const hash = crypto.createHash("sha256").update(encrypted).digest("hex");

//     // Upload encrypted file to Filecoin/IPFS via NFT.Storage
//     const blob = new Blob([encrypted]);
//     const cid = await nftClient.storeBlob(blob);

//     // Register on Lisk
//     const recordId = crypto.randomBytes(16).toString("hex");
//     await recordContract.register(recordId, hash, cid);

//     // Save locally
//     records[recordId] = { cid, hash, dek: dek.toString("hex"), patient };

//     res.json({ recordId, cid, hash });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Error uploading record");
//   }
// });

// // 2. Grant Consent
// app.post("/consents/grant", async (req, res) => {
//   try {
//     const { patient, doctor, recordId, expiry } = req.body;
//     await consentContract.grant(doctor, ethers.id("ALL"), expiry);
//     res.json({ success: true });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Error granting consent");
//   }
// });

// // 3. Fetch Record
// app.get("/records/:id", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { viewer } = req.query;

//     // Check consent on-chain
//     const allowed = await consentContract.isAllowed(records[id].patient, viewer, ethers.id("ALL"));
//     if (!allowed) return res.status(403).send("Access denied");

//     res.json({ cid: records[id].cid, dek: records[id].dek });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Error fetching record");
//   }
// });

// // -------------------- Start --------------------
// app.listen(3000, () => console.log("Zephyr backend running on http://localhost:3000"));
