var express = require('express');
var bodyParser = require('body-parser');
var app = express();

app.get('/test/', function (req, res) {
  res.end('Hello World -- 01 \n');
})

var port = process.env.PORT || 1337;
var server = app.listen(port, function () {
   var host = server.address().address
   var port = server.address().port

   console.log("Example app listening at http://%s:%s", host, port)
})



Date.prototype.addDays = function(days)
{
    var dat = new Date(this.valueOf());
    dat.setDate(dat.getDate() + days);
    return dat;
}