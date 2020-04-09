const state = {
    stands: {},
    standsById: {},
    filteredIDs: [],
    selectedIDs: [],
    missingSelected: [],
    ctrlDown: false,
    showPopups: true,
    year: -1,
    timeData: {},
    standsOnChart: 0
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

$('#popupSwitch').click(() => {
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
    if (error) {
        $('#map').replaceWith(`<div class="alert alert-danger" role="alert">Failed to load data: ` + error + '</div>');
        return;
    }
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

    map.on('boxzoomend', onMapSelectSquare);

    // Load first of each.
    createTable();
    changeYear(2019);
    zoomOnAll();
}

function select(id) {
    state.table.row((idx, data) => {
        return data.id === id;
    }).select().scrollTo();
    updateMapView();
}

function selectMany(ids) {
    state.table.rows((idx, data) => {
        return ids.includes(data.id);
    }).select();
    updateMapView();
}

function deselect(id) {
    state.table.row((idx, data) => {
        return data.id === id;
    }).deselect();
    updateMapView();
}

function deselectMany(ids) {
    state.table.rows((idx, data) => {
        return ids.includes(data.id);
    }).deselect();
    updateMapView();
}

function onMapSelectSquare(event) {
    const bounds = event.boxZoomBounds;
    if (!state.ctrlDown) {
        deselectMany(state.selectedIDs);
        // Remove selected from another year that would now be deselected.
        state.missingSelected = [];
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
    selectMany(selected);
    deselectMany(deselected);
    zoomOnSelected();
}

function onMarkerClick(id) {
    return () => {
        if (state.ctrlDown) {
            if (state.selectedIDs.includes(id)) {
                deselect(id);
            } else {
                select(id);
            }
        } else {
            const selected = state.selectedIDs.includes(id);
            const selectedMany = state.selectedIDs.length > 1;
            deselectMany(state.selectedIDs);
            state.missingSelected = []; // Remove selected from another year that would now be deselected.
            if (selected && !selectedMany) {
                deselect(id);
            } else {
                select(id);
            }
        }
    };
}

function onTableSearch() {
    if (!state.table.search()) {
        state.filteredIDs = [];
    } else {
        state.filteredIDs = state.table.rows({search: 'applied'})
            .data().pluck('id').toArray();
    }
}

function loadTimeData(id, callbackOnLoad) {
    caches.open('bike-data').then((cache) => {
        cache.match(new Request(id + '-' + state.year)).then((response => {
            if (response) {
                response.json().then(json => {
                    state.timeData[id] = json;
                    callbackOnLoad();
                });
            } else {
                requestJSON('data/json/data-' + id + '-' + state.year + '.json', function (json, error) {
                    if (error) {
                        console.error(error);
                        return;
                    }
                    state.timeData[id] = json.series;
                    cache.put(id + '-' + state.year, new Response(JSON.stringify(json.series)));
                    callbackOnLoad();
                })
            }
        }));
    });
}

function loadTimeDataMany(ids, callbackOnLoad) {
    const need = ids.length;
    let got = 0;
    for (let id of ids) {
        loadTimeData(id, () => got++);
    }

    function check() {
        if (got === need) {
            callbackOnLoad();
        } else {
            setTimeout(check, need * 25)
        }
    }

    check();
    if (got !== need) setTimeout(check, need * 25);
}

function onTableSelect(e, dt, type, indexes) {
    if (type === 'row') {
        let selected = state.table.rows(indexes).data().pluck('id').toArray();
        selected.forEach(function (id) {
            state.selectedIDs.push(id);
        });
        loadTimeDataMany(selected, updateChartView);
        // Remove selected from another year that would now be deselected.
        if (state.selectedIDs.length === 1) state.missingSelected = [];
        updateMapView();
    }
}

function onTableDeselect(e, dt, type, indexes) {
    if (type === 'row') {
        state.table.rows(indexes).data().pluck('id').toArray()
            .forEach(id => { // Remove from array
                state.selectedIDs.splice(state.selectedIDs.indexOf(id), 1);
                delete state.timeData[id];
            });
        updateMapView();
        updateChartView();
    }
}

function updateChartView() {
    const selectedIDs = state.selectedIDs;
    const count = selectedIDs.length;
    state.standsOnChart = count;
    if (count === 0) {
        $('#select-stand-text').removeClass('hidden');
        $('#graph').addClass('hidden');
    } else {
        $('#select-stand-text').addClass('hidden');
        $('#graph').removeClass('hidden');
        const timeData = state.timeData;
        const byDate = {};
        Object.keys(timeData).forEach(id => {
            timeData[id].forEach(entry => {
                let date = entry[0];
                if (!byDate[date]) byDate[date] = {};
                byDate[date][id] = (entry[2] >= entry[1] ? entry[1] : null);
            })
        });
        const data = Object.keys(byDate).map(key => [new Date(key), ...Object.values(byDate[key])]);

        if (state.graph) {
            state.graph.updateOptions({
                'file': data,
                labels: ['time', ...Object.keys(timeData).map(id => state.stands[id].name)]
            })
        } else {
            state.graph = new Dygraph(
                document.getElementById("graph"),
                data,
                {
                    labels: ['time', ...Object.keys(timeData).map(id => state.stands[id].name)],
                    customBars: false,
                    showRoller: true,
                    rollPeriod: 300,
                    ylabel: 'Available Bikes',
                    legend: (count < 7 ? 'always' : 'never'),
                    showRangeSelector: true,
                    highlightCircleSize: 1,
                    strokeWidth: 0.5,
                    strokeBorderWidth: 0.5,

                    highlightSeriesOpts: {
                        strokeWidth: 1,
                        strokeBorderWidth: 0.5,
                        highlightCircleSize: 2
                    }
                }
            );
        }
    }
}

function updateMapView() {
    const bikeStands = state.stands;
    let filteredIDs = state.filteredIDs;
    let selectedIDs = state.selectedIDs;

    for (let key of Object.keys(bikeStands)) {
        const stand = bikeStands[key];
        const hasNoFilter = !filteredIDs || !filteredIDs.length;
        const isVisible = hasNoFilter || filteredIDs.includes(stand.id);
        const isSelected = selectedIDs.includes(stand.id);

        if (isSelected) {
            stand.marker.setStyle(style.selectedCircle)
                .setRadius(stand.marker.options.radius);
            if (state.showPopups) {
                stand.marker.openPopup();
            }
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
}

function zoomOnSelected() {
    if (!state.selectedIDs.length) {
        zoomOnAll();
        return;
    }
    const pointLatLngs = [];
    for (let id of state.selectedIDs) {
        pointLatLngs.push(state.stands[id].marker.getLatLng());
    }
    zoomToBounds(new L.LatLngBounds(pointLatLngs));
}

function zoomOnAll() {
    const pointLatLngs = [];
    for (let id of Object.keys(state.stands)) {
        if (state.filteredIDs.includes(id)) continue;
        pointLatLngs.push(state.stands[id].marker.getLatLng());
    }
    zoomToBounds(new L.LatLngBounds(pointLatLngs));
}

function zoomToBounds(bounds) {
    map.flyToBounds(bounds, {animate: true, easeLinearity: 0.1, duration: 1.5});
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
    table.on('search.dt', onTableSearch);
    table.on('select', onTableSelect);
    table.on('user-select', () => setTimeout(zoomOnSelected, 5));
    table.on('deselect', onTableDeselect);
    state.table = table;
}

function changeYear(year) {
    state.year = year;
    $('.season-btn').removeClass('current');
    $('#btn' + year).addClass('current');
    for (let id of Object.keys(state.stands)) {
        state.stands[id].marker.remove();
    }
    loadStandsOfYear(year);

    // Draw bike stands on the map
    for (let id of Object.keys(state.stands)) {
        const stand = state.stands[id];

        const markerContent = stand.id + ' : ' + stand.name;
        stand.marker = L.circle([stand.y, stand.x], style.visibleCircle)
            .addTo(map)
            .bindPopup(markerContent, {autoClose: false, closeButton: false, closeOnEscapeKey: false})
            .addTo(map);

        // Links map click events to the selection state
        // Ctrl behavior is same on both table and map to reduce confusion
        stand.marker.on('click', onMarkerClick(id));
    }

    // Redraw table with stands of selected year
    const table = state.table;
    table.clear();
    table.rows.add(Object.keys(state.stands).map(function (id) {
        return {...state.stands[id]}
    }));
    table.draw();

    // Sort out selection if missing some selected items from another year
    state.missingSelected.forEach(id => state.selectedIDs.push(id));
    state.missingSelected = [];
    const toSelect = [];
    state.selectedIDs.forEach(id => {
        if (state.stands[id]) {
            toSelect.push(id);
        } else {
            state.missingSelected.push(id);
        }
    });
    state.selectedIDs = [];
    selectMany(toSelect);
    loadTimeDataMany(toSelect, updateChartView);

    updateMapView();
    // Reset Zoom
    zoomOnSelected();
}