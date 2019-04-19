var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cors = require('cors');

var app = express();
app.use(cors());

app.use(bodyParser.urlencoded({
    extended: true
}));

/**bodyParser.json(options)
 * Parses the text as JSON and exposes the resulting object on req.body.
 */
app.use(bodyParser.json());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/client', express.static('../client'));

var index = require('./routes/index');
app.use('/', index);

var part_anno_list_viewer = require('./routes/part_anno_list_viewer');
app.use('/part_anno_list_viewer', part_anno_list_viewer);

var part_annotator = require('./routes/part_annotator');
app.use('/part_annotator', part_annotator);

var annotation_manager = require('./routes/annotation_manager');
app.use('/annotation', annotation_manager);

var user = require('./routes/user');
app.use('/user', user);

var get_file = require('./routes/get_file');
app.use('/file', get_file);

var remeshing = require('./routes/remeshing');
app.use('/remesh', remeshing);

var submit_remesh_cut = require('./routes/submit_remesh_cut');
app.use('/submit_remesh_cut', submit_remesh_cut);

var template_viewer = require('./routes/template_viewer');
app.use('/template_viewer', template_viewer);

//The 404 Route (ALWAYS Keep this as the last route)
app.get('*', function(req, res){
    res.send('404: Not found!', 404);
});

module.exports = app;
