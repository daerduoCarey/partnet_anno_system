var express = require('express');
var router = express.Router();

var fs = require('fs');
var path = require('path');
var cmd = require('node-cmd');
var server = require('../config/server.js');

router.get('/original-part/:category_id/:model_id/:part_id', function (req, res, next) {
    var fn_path = server.DIR + '/' + server.DATA_DIR + '/' + req.params.category_id + '/' + req.params.model_id + '/' + server.ORI_PART_DIR + '/' + req.params.part_id+'.obj';
    console.log('[Get Original Part] fn_path: '+fn_path);
    res.status(200);
    res.download(fn_path);
});

router.get('/remesh-part/:anno_id-:part_id', function (req, res, next) {
    var fn_path = server.DIR + '/' + server.ANNO_DIR + '/' + req.params.anno_id + '/' + server.REMESH_PART_DIR + '/' + req.params.part_id+'.obj';
    console.log('[Get Remesh Part] fn_path: '+fn_path);
    res.status(200);
    res.download(fn_path);
});

router.get('/new-part/:anno_id-:part_id', function (req, res, next) {
    var fn_path = server.DIR + '/' + server.ANNO_DIR + '/' + req.params.anno_id + '/' + server.NEW_PART_DIR + '/' + req.params.part_id+'.obj';
    console.log('[Get New Part] fn_path: '+fn_path);
    res.status(200);
    res.download(fn_path);
});

router.get('/original-scene-graph/:category_id/:model_id', function (req, res, next) {
    var fn_path = server.DIR + '/' + server.DATA_DIR + '/' + req.params.category_id + '/' + req.params.model_id + '/leaf_part_ids.json';
    console.log('[Get Original Leaf Part List] fn_path: '+fn_path);
    res.status(200);
    res.download(fn_path);
});

router.get('/remesh-cut-output-json/:anno_id-:part_type-:part_id', function (req, res, next) {
    var part_dir = server.REMESH_PART_DIR;
    if (req.params.part_type === 'new') {
        part_dir = server.NEW_PART_DIR;
    }
    var fn_path = server.DIR + '/' + server.ANNO_DIR + '/' + req.params.anno_id + '/' + part_dir + '/' +
        req.params.part_id + '.new_parts.json';
    console.log('[Get Remesh Cut Output Json] fn_path: '+fn_path);
    res.status(200);
    res.download(fn_path);
});

router.get('/model-sceneshot/:model_id/:image_id', function (req, res, next) {
    var model_id = req.params.model_id;
    var image_id = req.params.image_id;
    console.log('model_id', model_id);
    console.log('image_id', image_id);

    var fn_path = server.DIR + '/' + server.SCREENSHOT_DIR + '/' +
        model_id.charAt(0)+ '/' + model_id.charAt(1)+ '/' + model_id.charAt(2)+ '/' + model_id.charAt(3)+ '/' + model_id.charAt(4)+ '/' +
        model_id.substring(5) + '/' + model_id + '/'  + model_id+'-'+image_id+'.png';

    fs.stat(fn_path, function(err, stat) {
        if(err == null) {
            console.log('[Get Model Screenshot] fn_path: '+fn_path);
            res.status(200);
            res.download(fn_path);
        } else if(err.code === 'ENOENT') {
            console.log('[Get Model Screenshot] fn_path: '+fn_path+' does not exist!');
            res.status(400);
            res.end();
        } else {
            console.log('[Get Model Screenshot] fn_path: '+fn_pat+' Other Errors!');
            res.status(400);
            res.end();
        }
    });

});

module.exports = router;
