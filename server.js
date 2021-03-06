var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var sql = require('mssql');

app.use(bodyParser.json());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


var carParkId = '36A4AF9C-AA4E-4B58-B8DE-328C9670F447';
var gateId = 'F844C637-4A41-4C01-8DAA-94ABC285BCEB';

var inboundDeviceId = '34D25D78-59E4-4D78-B76D-18B579645524';
var outboundDeviceId = '6D1BB9CC-AD54-48AE-8707-B7E0806973F4';
var carParkCapacity = 3;

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

app.get('/blocklist/GetUserInfo/:id', function (req, res) {
    sql.connect(config, function(err) {
        var request = new sql.Request();
        request.query('SELECT TOP 1 * FROM BlockList WHERE UserId = \'' + req.params.id + '\' AND [Status] = 1 AND GETDATE() < BlockTo ORDER BY BlockFrom DESC;', function(err, recordset) {
            res.json(recordset);
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


app.post('/gateevent/enter', function (req, res) {
    var data = {};    
    sql.connect(config, function(err) {
        var request = new sql.Request();
        request.input('carParkId', carParkId);
        request.input('userId', req.body.UserId); 
        var query = 'SELECT * FROM BlockList WHERE CarParkId = @carParkId AND UserId = @userId AND [Status] = 1 AND GETDATE() > BlockFrom AND GETDATE() < BlockTo;'
        request.query(query, function(err, recordset) {
            if(err != null)
            {
                console.log('Enter Error: ' + err);
                data.result = false;
                data.message = err;
                res.json(data);
            }
            
            if(recordset.length > 0)
            {
                data.result = false;
                data.message = 'User is blocked from accessing the car park';
                res.json(data);
            }
            else
            {           
                var request = new sql.Request();
                request.input('carParkId', carParkId);
                request.input('gateId', carParkId);
                request.input('deviceId', carParkId);
                request.input('userId', req.body.UserId);
                request.input('vehicleNumber', req.body.VehicleNumber);    
                var query = 'INSERT INTO GateLog (CarParkId, GateId, DeviceId, UserId, VehicleNumber, Direction) VALUES ( @carParkId, @gateId, @deviceId, @userId, @vehicleNumber, \'I\')';
                request.query(query, function(err, recordset) {
                    if(err == null)
                    {
                        data.result = true;
                        data.message = 'Success';
                        res.json(data);
                    }
                    else
                    {
                        console.log(err);
                        data.result = false;
                        data.message = err;
                        res.json(data);
                    }
                });
            }
        });
    });
});

app.post('/gateevent/exit', function (req, res) {
    var request = new sql.Request();
    request.input('carParkId', carParkId);
    request.input('gateId', carParkId);
    request.input('deviceId', carParkId);
    request.input('userId', req.body.UserId);
    request.input('vehicleNumber', req.body.VehicleNumber);
    var query = 'INSERT INTO GateLog (CarParkId, GateId, DeviceId, UserId, VehicleNumber, Direction) VALUES ( @carParkId, @gateId, @deviceId, @userId, @vehicleNumber, \'O\')';
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


app.get('/main/GetUserStatus/:id', function (req, res) {
    sql.connect(config, function(err) {
        var request = new sql.Request();
        var query = 'SELECT * FROM (SELECT TOP 1 Email, CASE WHEN B.Id IS NULL THEN \'N\' ELSE \'Blocked\' END BlockedStatus, BlockFrom BlockedStartDate, BlockTo BlockedEndDate FROM [User] U LEFT OUTER JOIN BlockList B ON B.UserId = U.UserId AND GETDATE() >= B.BlockFrom AND GETDATE() <= B.BlockTo WHERE U.UserId = @userId) X LEFT OUTER JOIN (SELECT  SUM(CASE WHEN TargetUserId = @userId THEN 1 ELSE 0 END) [Committed], SUM(CASE WHEN ReporterId = @reporterId THEN 1 ELSE 0 END) [Reported] FROM [ReportEvent] WHERE CarParkId = @carParkId AND ((TargetUserId = @userId AND [Status] = \'Processed\') OR ReporterId = @reporterId)) Y ON 1 = 1';
        request.input('carParkId', carParkId);
        request.input('userId', req.params.id);
        request.input('reporterId', req.params.id);
        console.log(req.params.id);
        request.query(query, function(err, recordset) {
            if(err != null)
            {
                console.log('GetUserStatus Error: ' + err);
            }
            
            if(recordset.length > 0)
            {
                res.json(recordset[0]);
            }
            else
            {
                res.json(null);
            }
        });
    });
});

app.get('/main/GetUserReported/:id', function (req, res) {
    sql.connect(config, function(err) {
        var request = new sql.Request();
        var query = 'SELECT * FROM [ReportEvent] WHERE CarParkId = @carParkId AND ReporterId = @reporterId ORDER BY DateCreated DESC';
        request.input('carParkId', carParkId);
        request.input('reporterId', req.params.id);
        request.query(query, function(err, recordset) {
            console.log(err);
            console.log(recordset);
            res.json(recordset);
        });
    });
});

app.get('/main/GetUserCommitted/:id', function (req, res) {
    sql.connect(config, function(err) {
        var request = new sql.Request();
        var query = 'SELECT * FROM [ReportEvent] WHERE CarParkId = @carParkId AND TargetUserId = @userId AND [Status] = \'Processed\' ORDER BY DateCreated DESC';
        request.input('carParkId', carParkId);
        request.input('userId', req.params.id);
        request.query(query, function(err, recordset) {
            res.json(recordset);
        });
    });
});

app.get('/main/GetCarParkStatus', function (req, res) {
    sql.connect(config, function(err) {
        var request = new sql.Request();
        var query = 'SELECT COUNT(1) Usage FROM CarParkAccess WHERE CarParkId = @carParkId AND LastOut IS NULL OR LastIn > LastOut;';
        request.input('carParkId', carParkId);
        request.query(query, function(err, recordset) {
            var usage = recordset[0].Usage;
            var availability = (carParkCapacity - usage)*100/carParkCapacity;
            
            var status = { 'Total' : carParkCapacity };
            status.CheckedIn  = usage;
            
            if(availability > 50)
                status.Availability = 'High';
            else if(availability > 25)
                status.Availability = 'Medium';
            else if(availability > 0 )
                status.Availability = 'Low';
            else
                status.Availability = 'Full';
            
            res.json(status);
        });
    });
});

app.post('/main/PostReport', function (req, res) {
    sql.connect(config, function(err) {
        var request = new sql.Request();
        request.input('vehicleNumber', req.body.PlateNumber);
        var query = 'SELECT TOP(1) * FROM [User] WHERE VehicleNumber = UPPER(REPLACE(@vehicleNumber, \' \', \'\'))';
        request.query(query, function(err, recordset) {
            
            if(err != null)
            {
                console.log(err);
                res.json('Query user info error:' + err);
            }
            
            if(recordset == null)
            {
                console.log(err);
                res.json('Unable to find user info');
            }
            
            if(recordset.length > 0)
            {
                var request = new sql.Request();
                request.input('carParkId', carParkId);
                request.input('reporterId', req.body.UserId);
                request.input('reportType', req.body.Offense);
                request.input('vehicleNumber', recordset[0].VehicleNumber);
                request.input('targetUserId', recordset[0].UserId);
                request.input('image', req.body.srcImage);
                request.input('status', 'Pending');
                var query = 'INSERT INTO [ReportEvent] (ReporterId, CarParkId, ReportType, VehicleNumber, TargetUserId, [Status], Image) VALUES (@reporterId, @carParkId, @reportType, UPPER(REPLACE(@vehicleNumber, \' \', \'\')) , @targetUserId, @status, @image)';
                request.query(query, function(err, recordset) {
                    console.log('Error:' + err);
                    console.log('Recordset:' + recordset);
                    if(err === null)
                    {
                        res.json(true);
                    }
                    else
                    {
                        res.json('Insert Event failed:' + err);
                    }
                });
            }
            else
            {
                res.json(false);
            }
        });
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