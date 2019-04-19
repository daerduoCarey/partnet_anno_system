var express = require('express');
var router = express.Router();
var server = require('../config/server.js');

var fs = require('fs'),
    path = require('path'),
    url = require('url');

var multiparty = require('multiparty');

var cmd = require('node-cmd');  // TODO node-cmd
var THREE = require('three');

router.post('/:anno_id-:part_type-:part_id', function (req, res, next) {
    console.log('[ POST request from /submit_remesh_cut ] ');

    var form = new multiparty.Form();

    form.on('error', function() {
        console.log('error');
    });

    var anno_id = req.params.anno_id;
    var part_type = req.params.part_type;
    var part_id = req.params.part_id;

    // listen on field event for title
    form.on('field', function(name, val){
        if (name === 'data') {
            var part_dir = server.REMESH_PART_DIR;
            if (part_type === 'new') {
                part_dir = server.NEW_PART_DIR;
            }
            var out_fn = server.DIR + '/' + server.ANNO_DIR + '/' + anno_id + "/" +
                part_dir + "/" + req.params.part_id+'.json';

            var obj = {data: val};
            var json = JSON.stringify(obj);
            console.log(out_fn);

            fs.writeFile(out_fn, json, 'utf8',
                function(err){
                    if (err) {
                        console.log(err);
                        console.log(json);
                    }
                });

            cmd.get(
                'python ' + server.CODE_DIR + '/server/python/get_remesh_cut_objs.py ' + out_fn,
                function(err, data, stderr) {
                    console.log(err);
                    res.status(200);
                    res.end();
                }
            );
        }
    });

    // parse the form
    form.parse(req);

});

module.exports = router;
