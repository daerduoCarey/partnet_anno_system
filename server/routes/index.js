var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', {title: 'PartNet Annotation Server',
        login_alert_txt: '', signup_alert_txt: ''});
});

module.exports = router;

