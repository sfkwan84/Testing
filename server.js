var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var sql = require('mssql');

app.use(bodyParser.json());

var carParkId = '36A4AF9C-AA4E-4B58-B8DE-328C9670F447';

var config = {
    user: 'sfkwan@poc-carpark.database.windows.net',
    password: 'hpe.poc-00',
    server: 'poc-carpark.database.windows.net',
    port: '1433',
    database: 'POC-CarPark',
    options: {
        encrypt: true
    }
};

app.get('/', function (req, res) {
    res.end('Hello World!!');
});

app.get('/blocklist/IsBlocked/:id', function (req, res) {
    sql.connect(config, function(err) {
        var request = new sql.Request();
        request.query('SELECT * FROM BlockList WHERE UserId = \'' + req.params.id + '\' AND [Status] = 1 AND GETDATE() > BlockFrom AND GETDATE() < BlockTo;', function(err, recordset) {            
            console.dir(recordset);
            if(recordset.length > 0)
            {
                res.json(true);
            }
            else
            {
                res.json(false);
            }
        });
    });
});

app.get('/blocklist/RemoveBlock/:id', function (req, res) {
    var request = new sql.Request();
    request.query('UPDATE BlockList SET [Status] = 0 WHERE Id = \'' + req.params.id + '\';', function(err, recordset) {
        res.json(1);
    });
});

app.get('/blocklist/GetAll', function (req, res) {
    sql.connect(config, function(err) {
        if(err != null)
        {
            res.json(err);
        }
        
        var request = new sql.Request();
        request.query('SELECT * FROM BlockList ;', function(err, recordset) {
            res.json(recordset);
        });
    });
});

app.post('/blocklist/Add/', function (req, res) {
    var request = new sql.Request();
    request.input('carParkId', carParkId);
    request.input('userId', req.body.UserId);
    request.input('blockFrom', new Date().addDays(1));
    request.input('blockTo', new Date().addDays(6));
    var query = 'INSERT INTO BlockList (CarParkId, UserId, BlockFrom, BlockTo) VALUES ( @carParkId, @userId, @blockFrom, @blockTo)';
    request.query(query, function(err, recordset) {
        if(err == null)
        {
            res.json(true);
        }
        else
        {
            res.json(false);
        }
    });
});

Date.prototype.addDays = function(days)
{
    var dat = new Date(this.valueOf());
    dat.setDate(dat.getDate() + days);
    return dat;
};


var port = process.env.PORT || 1337;
var server = app.listen(port, function () {
var host = server.address().address;
var port = server.address().port;
    console.log("Example app listening at http://%s:%s", host, port);
});