const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 5000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

function parseGvizResponse(body) {
  const match = body.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);?\s*$/);
  if (!match) {
    throw new Error('Invalid Google Sheets response');
  }

  const payload = JSON.parse(match[1]);
  if (payload.status !== 'ok') {
    const message = payload.errors?.[0]?.detailed_message || 'Unable to read Google Sheet';
    throw new Error(message);
  }

  return payload.table;
}

function tableToJson(table) {
  const headers = table.cols.map((col, index) => {
    const label = (col.label || '').trim();
    return label || `column${index + 1}`;
  });

  const rows = table.rows
    .map(row => {
      const record = {};
      row.c.forEach((cell, index) => {
        const key = headers[index];
        if (!key) {
          return;
        }
        record[key] = cell?.v ?? null;
      });
      return record;
    })
    .filter(row => Object.values(row).some(value => value !== null && value !== ''));

  return { data: rows };
}

async function fetchSheet(id, sheet) {
  const sheetNumber = Number(sheet) || 1;
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&headers=1&sheet=Sheet${sheetNumber}`;
  const response = await fetch(url);
  const body = await response.text();

  if (!response.ok || body.includes('No se encontró la página') || body.includes('No se pudo abrir el archivo')) {
    throw new Error('Google Sheet not found or not publicly accessible');
  }

  return tableToJson(parseGvizResponse(body));
}

app.get('/api', async (req, res) => {
  const id = req.query.id;
  const sheet = req.query.sheet || 1;

  if (!id) {
    return res.status(400).sendFile('public/error.html', { root: __dirname });
  }

  try {
    const output = await fetchSheet(id, sheet);
    if (!output.data.length) {
      return res.status(400).sendFile('public/error.html', { root: __dirname });
    }
    return res.status(200).json(output);
  } catch (error) {
    console.error(error);
    return res.status(400).sendFile('public/error.html', { root: __dirname });
  }
});

app.use((err, req, res, next) => {
  res.status(400).send(err.message);
});

app.listen(port, () => {
  console.log('App is running on ' + port);
});
