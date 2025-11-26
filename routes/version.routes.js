const express = require('express');
const router = express.Router();

const appInfo = {
  latestVersion: process.env.APK_VERSION,
  apkUrl: process.env.APK_URL
};

router.get("/", (req, res) => {
  res.json(appInfo);
});

module.exports = router;
