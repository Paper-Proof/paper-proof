const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express()
const port = 3666


// Serve static files from the 'widget/dist' directory
app.use('/paperProof-widget', express.static(path.join(__dirname, 'widget', 'dist')));


const allowedOrigins = ['localhost:5431']
app.use(cors({
  origin: function (origin, callback) {
    return callback(null, true);
    /*if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);*/
  }

}));

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Hello World!')
})

let hyps = [];
let curId = 1;

app.post('/sendTypes', (req, res) => {
  const data = req.body;
  hyps = { data, id: curId++ };
  console.log('Receved', data);
  res.send(`Receved ${data}`);
});

app.get('/getTypes', (req, res) => {
  res.send(hyps);
});


function getInlineHtmlWithJsTag(jsUrl) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>My Page</title>
      </head>
      <body>
        <h1>Hello, world!</h1>
        <div id="root"></div>
        <script src="${jsUrl}"></script>
      </body>
    </html>
  `;
  return html;
}


app.get('/my-page', (req, res) => {
  const myJsUrl = '/paperProof-widget/indexIpad.js'
  const myHtml = getInlineHtmlWithJsTag(myJsUrl);
  res.send(myHtml);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})