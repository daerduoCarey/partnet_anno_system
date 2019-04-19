## Client-side Code

### Installation

The client side use `node.js` and `browserify`. 

First, install  `node.js` and `browserify` as follows.

        curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.1/install.sh | bash
        source ~/.bashrc
        nvm install node
        npm install -g browserify

The part hier visualization uses [Bootstrap Tree View](https://github.com/jonmiles/bootstrap-treeview). Please install

        npm install -g bower
        npm install bootstrap-treeview
        
Next, install `node.js` dependent modules as defined in `package.json`.

        npm install
        
Finally, compile the client-side javascript dependencies using `browserify` by running the following.
        
        ./build.sh
        
This will generate a `build/ShapeNetPP.bundle.js` that includes all node-js modules defined by `require`.


### Usage

Set up config files,

        cp config/backend.js.template config/backend.js
        [fill in the information in this file]

To run the system, please go to server-side code, set up server-side and run 

        cd ../server
        # read README for the server side to install
        npm start
        
Open browser, and go to 
        
        http://localhost:3000


### Interface Descriptions

There are three main webpages that construct the system: login page, viewer page, and annotator page. 

* The login page provides you functions to register yourself as a worker and log in to annotate. 
* The viewer page lists all annotations that have been done and provides functions to label new shapes. Each worker can see the models annotated by himself or herself only. We reserve a special username *admin* that can manage all annotations from all workers. Admin account also has the privilege to download the annotations.
* The annotator page is the main page where annotation for a model happens. It provides many utilities to view the 3D model, view part templates, annotate a part in the template, click-and-group parts, and split parts by cutting. Please click *help* on the top-left corner on the webpage for keyboard shortcuts. 

We strongly recommend you to refer to [the paper](https://arxiv.org/abs/1812.02713) and [the Youtube annotation video](https://youtu.be/7pEuoxmb-MI) for mode detailed demonstrations.

