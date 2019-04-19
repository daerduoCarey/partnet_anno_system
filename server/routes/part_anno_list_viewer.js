var express = require('express');
var router = express.Router();

// part anno list viewer
router.post('/', function (req, res) {
    var username = req.body.username;
    if (username === null) {
        res.end('Please log in first!');
    } else if (username === 'admin') {
        res.render('admin_list_viewer', {username: username});
    } else {
        res.render('part_anno_list_viewer', {username: username});
    }
});

module.exports = router;

