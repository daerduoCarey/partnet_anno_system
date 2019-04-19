var express = require('express');
var router = express.Router();

var server = require('../config/server.js');

// part annotator
router.post('/', function (req, res) {

    var load_parent_anno = req.body.load_parent_anno;

    if (load_parent_anno === undefined) {
        load_parent_anno = false;
    }

    var allow_edit = req.body.allow_edit;
    if (allow_edit === undefined) {
        allow_edit = false;
    }

    var anno_id = req.body.anno_id;

    res.render('part_annotator', {anno_id: anno_id,
        load_parent_anno: load_parent_anno, allow_edit: allow_edit
    });
});

module.exports = router;

