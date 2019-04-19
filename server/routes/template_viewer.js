var express = require('express');
var router = express.Router();

router.get('/:category_id', function (req, res, next) {
    var category_id = req.params.category_id;
    res.render('template_visualizer', {category_id: category_id});
});

module.exports = router;

