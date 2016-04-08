var app,
    bodyParser,
    cookieParser,
    Database,
    database,
    express,
    handlebars,
    http,
    mongoose,
    path,
    port,
    routes,
    server,
    users;

express = require('express');
cookieParser = require('cookie-parser');
bodyParser = require('body-parser');
mongoose = require('mongoose');
Database = require('./server/database');
routes = require('./routes/index');
users = require('./routes/users');
handlebars  = require('express-handlebars');
http = require('http');
path = require('path');

port = process.env.PORT || '3000';
database = new Database({
    databaseUri: process.env.DATABASE_URI || 'mongodb://localhost:27017/capabilities-catalog',
    service: mongoose
});

app = express();

app.set('views', path.join(__dirname, 'server', 'views'));
app.set('view engine', 'handlebars');
app.engine('handlebars', handlebars({
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'server', 'views', 'layouts')
}));

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

database.connect(function () {
    console.log("Database connected.");
});
app.set('port', port);
server = http.createServer(app);
server.listen(port);
