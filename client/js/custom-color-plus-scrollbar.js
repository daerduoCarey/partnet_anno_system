var config = {
        container: "#OrganiseChart1",
        rootOrientation:  'NORTH', // NORTH || EAST || WEST || SOUTH
        // levelSeparation: 30,
        siblingSeparation:   5,
        subTeeSeparation:    10,
        scrollbar: "fancy",
        
        connectors: {
            type: 'step'
        },
        node: {
            HTMLclass: 'nodeExample1'
        }
    },
    ceo = {
        text: {
            name: "Part 1",
            title: "Part Name",
        },
        HTMLid: "ceo"
    },

    cto = {
        parent: ceo,
        text:{
            name: "Part 2",
            title: "Part Name",
        },
        stackChildren: true,
        HTMLid: "coo"
    },
    cbo = {
        parent: ceo,
        text:{
            name: "Part 3",
            title: "Part Name",
        },
        HTMLid: "cbo"
    },

    cio = {
        parent: cto,
        text:{
            name: "Part 4",
            title: "Part Name"
        },
        HTMLid: "cio"
    }


    ALTERNATIVE = [
        config,
        ceo,
        cto,
        cbo,
        cio,
    ];