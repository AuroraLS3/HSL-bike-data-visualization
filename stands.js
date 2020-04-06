const state = {
    stands: {},
    standsById: {},
    filteredIDs: [],
    selectedIDs: [],
    previousFilterLength: 0,
    previousSelectLength: -1,
    ctrlDown: false,
    showPopups: true
};
const style = {};

style.visibleCircle = {
    color: '#0099cc',
    fillColor: '#0099cc',
    fillOpacity: 0.5,
    opacity: 1.0,
    radius: 40,
    weight: 1
};
style.selectedCircle = {
    ...style.visibleCircle,
    color: '#ffac63',
    fillColor: '#ffac63',
};
style.hiddenCircle = {
    ...style.visibleCircle,
    color: '#929292',
    fillColor: '#929292',
    opacity: 0.7,
    radius: 20
};

// Keep ctrl key status for selection differences
document.addEventListener("keydown", event => {
    if (event.key === 'Control') state.ctrlDown = true;
});
document.addEventListener("keyup", event => {
    if (event.key === 'Control') state.ctrlDown = false;
});

$('#popupSwitch').click(event => {
    state.showPopups = $('#popupSwitch').is(":checked");
    updateMapView();
});

function loadStandsOfYear(year) {
    state.stands = {};
    for (let id of Object.keys(state.standsById)) {
        for (let stand of state.standsById[id]) {
            if (stand.year === year) {
                state.stands[id] = stand;
                break;
            }
        }
    }
}

function printStands(id) {
    console.log(state.standsById[id])
}

function isEqual(obj1, obj2) {
    if (!isEqualArray(Object.keys(obj1), Object.keys(obj2))) return false;
    for (let key of Object.keys(obj1)) {
        if (obj1[key] !== obj2[key]) return false;
    }
    return true;
}

function isEqualArray(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }
    return true;
}

function loadCSV(bytes) {
    const decompressedUint8Array = new Zlib.Gunzip(bytes).decompress();
    const asString = new TextDecoder("utf-8").decode(decompressedUint8Array);
    const matrix = CSV.parse(asString);
    const model = matrix[0];

    const asObjects = [];
    for (let row = 1; row < matrix.length; row++) {
        const entry = matrix[row];
        const object = {};
        let col = 0;
        for (let key of model) {
            object[key] = entry[col].trim();
            col++;
        }
        asObjects.push(object);
    }

    console.log("Object model: ", model, " - Loaded: ", asObjects.length + " rows");

    return asObjects;
}

function loadStands(data, error) {
    const asObjects = loadCSV(data);

    const invalidIDs = [
        '0',    // Test entry
        '1',    // Test entry
        '0390', // Russian UTF-8 test entry
        '0523', '0533', '0534', // Workshop entries
    ];
    const correctionEntries = {
        '0529': {y: 60.194992, x: 25.115572},
        '0516': {name: 'Vuosaari (M) / it\u00e4'},
        '0507': {name: 'Vuosaari (M) / l\u00e4nsi'}
    };
    const byId = state.standsById;
    for (let object of asObjects) {
        let id = object.id;
        if (invalidIDs.includes(id)) continue;

        if (!byId[id]) {
            byId[id] = [];
        }

        let newStand = {
            id: id,
            name: object.name,
            x: parseFloat(object.x.replace(',', '.')),
            y: parseFloat(object.y.replace(',', '.')),
            // time: new Date(object.time),
            // yday: parseInt(object.yday),
            year: parseInt(object.year)
        };

        if (correctionEntries[id]) {
            newStand = {...newStand, ...correctionEntries[id]}
        }

        if (!byId[id].some(function (stand) {
            return isEqual(stand, newStand)
        })) {
            byId[id].push(newStand);
        }
    }

    map.on('boxzoomend', function (event) {
        const bounds = event.boxZoomBounds;
        if (!state.ctrlDown) {
            state.table.rows((idx, data, node) => {
                return state.selectedIDs.includes(data.id);
            }).deselect();
        }
        const selected = [];
        const deselected = [];
        for (let id of Object.keys(state.stands)) {
            if (bounds.contains(state.stands[id].marker.getLatLng())) {
                if (state.selectedIDs.includes(id)) {
                    deselected.push(id);
                } else {
                    selected.push(id);
                }
            }
        }
        console.log('selecting', selected);
        console.log('deselecting', deselected);
        selectMany(selected);
        deselectMany(deselected);
    });

    // Load first of each.
    createTable();
    changeYear(2019);
}

function updateMapView() {
    const bikeStands = state.stands;
    let filteredIDs = state.filteredIDs;
    let selectedIDs = state.selectedIDs;
    let previousFilterLength = state.previousFilterLength;
    let previousSelectLength = state.previousSelectLength;

    const pointLatLngs = [];
    for (let key of Object.keys(bikeStands)) {
        const stand = bikeStands[key];
        const hasNoFilter = !filteredIDs || !filteredIDs.length;
        const isVisible = hasNoFilter || filteredIDs.includes(stand.id);

        const hasNoSelection = !selectedIDs || !selectedIDs.length;
        const isSelected = hasNoSelection || selectedIDs.includes(stand.id);

        if (isSelected) {
            pointLatLngs.push(stand.marker.getLatLng());
        }
        if (!hasNoSelection && isSelected) {
            stand.marker.setStyle(style.selectedCircle)
                .setRadius(stand.marker.options.radius)
                .openPopup();
        } else {
            stand.marker.closePopup();
            if (isVisible) {
                stand.marker.setStyle(style.visibleCircle)
                    .setRadius(stand.marker.options.radius - (hasNoFilter ? 20 : 0));
            } else {
                stand.marker.setStyle(style.hiddenCircle)
                    .setRadius(stand.marker.options.radius);
            }
        }
        if (!state.showPopups) {
            stand.marker.closePopup();
        }
    }
    if (previousSelectLength !== selectedIDs.length) {
        var bounds = new L.LatLngBounds(pointLatLngs);
        map.flyToBounds(bounds, {animate: true, easeLinearity: 0.1, duration: 1.5});
    }

    state.previousFilterLength = filteredIDs.length;
    state.previousSelectLength = selectedIDs.length;
}

function createTable() {
    const table = $('#stands').DataTable({
        responsive: true,
        select: true,
        scroller: true,
        deferRender: false,
        scrollY: "80vh",
        scrollCollapse: true,
        paging: true,
        columns: [{title: '<i class="fa fa-bicycle"></i> Bike Stands', data: 'name'}],
        data: [],
        order: [[0, "asc"]]
    });
    state.table = table;
    table.on('search.dt', function () {
        if (!table.search()) {
            state.filteredIDs = [];
        } else {
            state.filteredIDs = table.rows({search: 'applied'})
                .data().pluck('id').toArray();
        }
        updateMapView();
    });
    table.on('select', function (e, dt, type, indexes) {
        if (type === 'row') {
            table.rows(indexes).data().pluck('id')
                .toArray().forEach(function (id) {
                state.selectedIDs.push(id);
            });
            updateMapView();
        }
    });
    table.on('deselect', function (e, dt, type, indexes) {
        if (type === 'row') {
            table.rows(indexes).data().pluck('id').toArray()
                .forEach(id => { // Remove from array
                    state.selectedIDs.splice(state.selectedIDs.indexOf(id), 1);
                });
            updateMapView();
        }
    });
}

function select(id) {
    state.table.row((idx, data, node) => {
        return data.id === id;
    }).select().scrollTo();
}

function selectMany(ids) {
    state.table.rows((idx, data, node) => {
        return ids.includes(data.id);
    }).select();
}

function deselect(id) {
    state.table.row((idx, data, node) => {
        return data.id === id;
    }).deselect();
}

function deselectMany(ids) {
    state.table.rows((idx, data, node) => {
        return ids.includes(data.id);
    }).deselect();
}

function changeYear(year) {
    $('.season-btn').removeClass('current');
    $('#btn' + year).addClass('current');
    for (let id of Object.keys(state.stands)) {
        state.stands[id].marker.remove();
    }
    loadStandsOfYear(year);

    // Draw bike stands on the map
    for (let id of Object.keys(state.stands)) {
        const stand = state.stands[id];

        const markerContent = '<div>' + stand.id + ' : ' + stand.name + '</div>';
        stand.marker = L.circle([stand.y, stand.x], style.visibleCircle)
            .bindPopup(markerContent, {autoClose: false, closeButton: false})
            .addTo(map);

        // Links map click events to the selection state
        // Ctrl behavior is same on both table and map to reduce confusion
        stand.marker.on('click', (e) => {
            if (state.ctrlDown) {
                if (state.selectedIDs.includes(id)) {
                    deselect(id);
                } else {
                    select(id);
                }
            } else {
                const selected = state.selectedIDs.includes(id);
                const selectedMany = state.selectedIDs.length > 1;
                if (selectedMany) {
                    state.table.rows((idx, data, node) => {
                        return state.selectedIDs.includes(data.id);
                    }).deselect();
                }
                if (selected && !selectedMany) {
                    deselect(id);
                } else {
                    select(id);
                }
            }
        });
    }

    const table = state.table;
    table.clear();
    table.rows.add(Object.keys(state.stands).map(function (id) {
        return {...state.stands[id]}
    }));
    table.draw();

    state.previousSelectLength = -1;
    updateMapView();
}