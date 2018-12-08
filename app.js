const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 5000;
const request = require('request');

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/api', (req, res) => {
  const id = req.query.id;
  const sheet = req.query.sheet || 1;
  const url = `https://spreadsheets.google.com/feeds/list/${id}/${sheet}/public/values?alt=json`;

  function processRequest(response) {
    const sheet = JSON.parse(response.body);
    const rows = Object.keys(sheet.feed.entry).map(key => sheet.feed.entry[key]);
    const values = rows.map(row => {
      const obj = {};
      const keys = Object.keys(row).filter(key => key.includes('gsx$'));
      keys.map(key => (obj[key.slice(4, key.length)] = !isNaN(row[key].$t) ? Number(row[key].$t) : row[key].$t));
      return obj;
    });
    const output = { data: values };
    return res.status(200).json(output);
  }

  function handleError(error) {
    return res.status(response.statusCode).json(error);
  }

  request(url, (error, response) => {
    if (!error && response.statusCode === 200) {
      processRequest(response);
    } else {
      handleError(error);
    }
  });
});

app.use((err, req, res, next) => {
  res.status(400).send(err.message);
});

app.listen(port, () => {
  console.log('App is running on ' + port);
});
