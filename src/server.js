const app = require('./app');

const port = Number(process.env.PORT) || 5001;

app.listen(port, () => {
  console.log(`MET Academy Student API listening on port ${port}`);
});
