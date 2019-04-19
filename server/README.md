## Server-side Code

### Installation
The server-side uses `node.js` and `express.js`. Please install it by

        curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.1/install.sh | bash
        source ~/.bashrc
        nvm install node
        
Next, install `node.js` dependent modules as defined in `package.json`.

        npm install

We use MYSQL to store annotation meta-data. Please use Mysql version v5.7. See instruction from `https://www.digitalocean.com/community/tutorials/how-to-install-the-latest-mysql-on-ubuntu-16-04`.

### Usage

For MYSQL set up, check `mysql/create_table.sql`.

        mysql -u root -p < mysql/create_table.sql

Then, you need to load the model list, run node

        python mysql/import_into_mysql.py

Fill in the system setup information

        cp bin/www.template bin/www
        cp config/server.js.template config/server.js
        cp python/config.py.template python/config.py
        [Fill in the information in the files]

Set up the client side code according to the `README.md` file there.

Finally, run the following command to start the server.

        npm start

### Instructions

The system requires part hierarchical templates and the original ShapeNet meta-parts extracted from the KMZ files to normally function. 
* We provide the 24 templates in PartNet under `public/part_hier_templates/`. If you want to annotate for a new category, please define your template and use the same format as the 24 categories. 
* The original ShapeNet meta-parts are not officially released to the public. We provide 4 examples (2 beds and 2 chairs). Please contact [ShapeNet Web Master](mailto:shapenetwebmaster@gmail.com) to request the data. Basically, the ShapeNet models come with many groups and parts information that are made by the CAD designers. There is no guarantee for the part quality. Some parts are too coarse and many are too fine-grained. We take advantage of them to warm-start our annotations. If you work on your own data, you can consider 1) provide the meta-parts that exist in your CAD models; 2) treat the entire shape as one part.

