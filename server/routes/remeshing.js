var express = require('express');
var router = express.Router();
var server = require('../config/server.js');

var fs = require('fs'),
    path = require('path'),
    url = require('url');

var cmd = require('node-cmd');  // TODO node-cmd
var THREE = require('three');

router.get('/:code', function (req, res, next) {
    console.log('[ GET request from /remeshing ] with code: ' + req.params.code);

    cmd.get(
        'python ' + server.CODE_DIR + '/server/python/process_remesh.py ' + req.params.code,
        function(err, data, stderr) {
            console.log(err);
            res.status(200);
            res.end(data);
        }
    );
});

module.exports = router;
