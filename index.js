var app,
    bodyParser,
    cookieParser,
    express,
    http,
    path,
    port,
    routes,
    server,
    users;

express = require('express');
cookieParser = require('cookie-parser');
bodyParser = require('body-parser');
routes = require('./routes/index');
users = require('./routes/users');
http = require('http');
path = require('path');

port = process.env.PORT || '3000';

app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

// Catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// Development error handler
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// Production error handler
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

app.set('port', port);
server = http.createServer(app);
server.listen(port);
