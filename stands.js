const Mode = {
    LINE: 'line',
    BAR: 'bar'
};

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
    standsOnChart: 0,
    hueForGeneration: Math.random(),
    mode: Mode.LINE,
    slider: 0,
    playing: false
};
const style = {};

const colorMaps = {
    cold: {
        old: '#0099cc',
        single: '#5EBCD2',
        more: ['#DCECC9', '#B3DDCC', '#8ACDCE', '#62BED2', '#46AACE', '#3D91BE', '#3577AE', '#2D5E9E', '#24448E', '#1C2B7F', '#162065', '#11174B']
    },
    hot: {
        old: '#ffac63',
        single: '#F4B656',
        more: ['#FDED86', '#FDE86E', '#F9D063', '#F5B857', '#F0A04B', '#EB8A40', '#E77235', '#E35B2C', '#C74E29', '#9D4429', '#753C2C', '#4C3430']
    },
    grayscale: {
        single: '#929292'
    },
    randomized: []
};

for (let i = 0; i < 100; i++) {
    const rgb = hsvToRgb(...randomHSVColor());
    colorMaps.randomized.push(`rgb(${rgb[0]}, ${rgb[1]},${rgb[2]})`);
}

style.visibleCircle = {
    color: colorMaps.cold.single,
    fillColor: colorMaps.cold.single,
    fillOpacity: 0.75,
    opacity: 1.0,
    radius: 40,
    weight: 1
};
style.selectedCircle = {
    ...style.visibleCircle,
    color: colorMaps.hot.single,
    fillColor: colorMaps.hot.single,
};
style.hiddenCircle = {
    ...style.visibleCircle,
    color: colorMaps.grayscale.single,
    fillColor: colorMaps.grayscale.single,
    opacity: 0.5,
    radius: 20
};

// Keep ctrl key status for selection differences
document.addEventListener("keydown", event => {
    if (event.key === 'Control') state.ctrlDown = true;
});
document.addEventListener("keyup", event => {
    if (event.key === 'Control') state.ctrlDown = false;
});

function hsvToRgb(h, s, v) {
    var r, g, b;

    var i = Math.floor(h * 6);
    var f = h * 6 - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0:
            r = v, g = t, b = p;
            break;
        case 1:
            r = q, g = v, b = p;
            break;
        case 2:
            r = p, g = v, b = t;
            break;
        case 3:
            r = p, g = q, b = v;
            break;
        case 4:
            r = t, g = p, b = v;
            break;
        case 5:
            r = v, g = p, b = q;
            break;
    }

    return [r * 255, g * 255, b * 255];
}

function randomHSVColor() {
    const goldenRatioConjugate = 0.618033988749895;
    state.hueForGeneration += goldenRatioConjugate;
    const hue = (state.hueForGeneration) % 1;
    const saturation = 0.7;
    const value = 0.7 + (Math.random() / 10);
    return [hue, saturation, value]
}

function getColors(howMany) {
    switch (howMany) {
        case 1:
            return [colorMaps.cold.more[5]];
        case 2:
            return [colorMaps.cold.more[2], colorMaps.cold.more[6]];
        case 3:
            return [colorMaps.cold.more[2], colorMaps.cold.more[6], colorMaps.cold.more[9]];
        default:
            const colors = [];
            for (let i = 0; i < howMany; i++) {
                colors.push(colorMaps.randomized[i % 100]);
            }
            return colors;
    }
}

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
    // Stands with no bikes available the whole year even though they show up in the data, checked manually.
    const invalidForYears = {
        2017: [],
        2018: ['097', '102'],
        2019: []
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

        if (invalidForYears[newStand.year].includes(id)) {
            continue;
        }

        if (correctionEntries[id]) {
            newStand = {...newStand, ...correctionEntries[id]}
        }

        if (!byId[id].some(function (stand) {
            return isEqual(stand, newStand)
        })) {
            byId[id].push(newStand);
        }
    }
    const aliases = findAliasIds();
    for (let id of Object.keys(aliases)) {
        for (let stand of byId[id]) {
            stand.aliases = aliases[id];
        }
    }

    map.on('boxzoomend', onMapSelectSquare);

    createTable();
    changeYear(2019);
    zoomOnAll();
}

function findAliasIds() {
    const standsNearEachOther = {};
    // Go over the array to find all changed ids.
    for (let id of Object.keys(state.standsById)) {
        for (let id2 of Object.keys(state.standsById)) {
            if (id === id2) continue;
            for (let stand of state.standsById[id]) {
                for (let stand2 of state.standsById[id2]) {
                    if (Math.abs(stand.x - stand2.x) < 0.000000001 && Math.abs(stand.y - stand2.y) < 0.000000001) {
                        standsNearEachOther[id] = standsNearEachOther[id] ? standsNearEachOther[id] : {};
                        standsNearEachOther[id][stand2.year] = id2;
                    }
                }
            }
        }
    }
    return standsNearEachOther;
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
    for (let id of Object.keys(state.stands).sort()) {
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
    updateMapView();
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
                requestJSON('data/json-grouped/data-' + id + '-' + state.year + '.json', function (json, error) {
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
    $('#select-stand-text').addClass('hidden');
    $('#too-many-text').addClass('hidden');
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
        $('#loader-background').removeClass('hidden');
        let selected = state.table.rows(indexes).data().pluck('id').toArray();
        selected.forEach(function (id) {
            state.selectedIDs.push(id);
        });
        loadTimeDataMany(selected, updateChartView);
        // Remove selected from another year that would now be deselected.
        if (state.selectedIDs.length === 1) {
            state.missingSelected = [];
            // Scroll to on table if only one is selected.
            state.table.row((idx, data) => {
                return data.id === state.selectedIDs[0];
            }).scrollTo();
        }
        const selectedCount = state.selectedIDs.length;
        if (selectedCount > 100 && state.showPopups) {
            $('#popupSwitch').click();
            state.showPopups = false;
            showAlert('Automatically disabled labels to improve render performance.', 5000, 'warning')
        } else {
            updateMapView();
        }
    }
}

function onTableDeselect(e, dt, type, indexes) {
    if (type === 'row') {
        $('#loader-background').removeClass('hidden');
        state.table.rows(indexes).data().pluck('id').toArray()
            .forEach(id => { // Remove from array
                state.selectedIDs.splice(state.selectedIDs.indexOf(id), 1);
                delete state.timeData[id];
            });
        updateMapView();
        updateChartView();
    }
}

function drawGraph(data, graphedIDs, count, maxValue) {
    if (state.graph) {
        state.graph.updateOptions({
            'file': data,
            labels: ['time', ...graphedIDs.map(id => state.stands[id].name)],
            colors: getColors(count),
            valueRange: [0, maxValue]
        })
    } else {
        state.graph = new Dygraph(
            document.getElementById("graph"),
            data,
            {
                labels: ['time', ...graphedIDs.map(id => state.stands[id].name)],
                colors: getColors(count),
                customBars: false,
                rollPeriod: 3,
                ylabel: 'Average Available Bikes by Hour',
                legend: 'always',
                showRangeSelector: true,
                rangeSelectorPlotStrokeColor: colorMaps.cold.single,
                rangeSelectorPlotFillColor: "",
                highlightCircleSize: 1,
                strokeWidth: 1,
                strokeBorderWidth: 1,
                includeZero: true,
                valueRange: [0, maxValue],

                highlightSeriesOpts: {
                    strokeWidth: 1.2,
                    strokeBorderWidth: 1.2,
                    highlightCircleSize: 2
                }
            }
        );
        zoomOnMonth();
    }
}

function updateChartView() {
    const selectedIDs = state.selectedIDs;
    const count = selectedIDs.length;
    state.standsOnChart = count;
    let graphContainer = $('#graph-container');
    let barContainer = $('#bar-container');
    if (count === 0) {
        $('#select-stand-text').removeClass('hidden');
        graphContainer.addClass('hidden');
        barContainer.addClass('hidden');
    } else if (count > 50) {
        $('#too-many-text').removeClass('hidden');
        graphContainer.addClass('hidden');
        barContainer.addClass('hidden');
    } else {
        const timeData = state.timeData;
        let graphedIDs = Object.keys(timeData).sort();

        let maxValue = 0;
        const byDate = {};
        graphedIDs.forEach(id => {
            timeData[id].forEach(entry => {
                const date = entry[0];
                const value = entry[1];
                if (value > maxValue) maxValue = value;
                if (!byDate[date]) byDate[date] = {};
                // Attempts to keep data intact
                // - Only keeps one entry per id per date
                // - Uses smallest 'available' value
                const existing = byDate[date][id] ? byDate[date][id] : null;
                byDate[date][id] = existing ? Math.min(value, existing) : value;
                // Inserts nulls in case some series is missing values to avoid irregular size arrays.
                for (let graphedID of graphedIDs) {
                    if (!byDate[date][graphedID]) byDate[date][graphedID] = null;
                }
            })
        });
        const data = Object.keys(byDate).map(date => {
            const standLabels = Object.entries(byDate[date]).sort((a, b) => a[0].localeCompare(b[0])).map(e => e[1]);
            return [new Date(date), ...standLabels]
        });
        state.data = data;
        state.maxValue = maxValue;

        switch (state.mode) {
            case Mode.LINE:
                barContainer.addClass('hidden');
                graphContainer.removeClass('hidden');
                drawGraph(data, graphedIDs, count, maxValue);
                break;
            case Mode.BAR:
                graphContainer.addClass('hidden');
                barContainer.removeClass('hidden');
                $('#timeSlider').attr('max', data.length);
                updateBarChart();
                break;
            default:
                showAlert("Invalid mode selected: " + state.mode, 4000, "danger");
                break;
        }
    }
    $('#loader-background').addClass('hidden');
}

function updateBarChart() {
    // Avoid going out of bounds
    if (state.slider >= state.data.length) state.slider = state.data.length - 1;

    const count = state.selectedIDs.length;
    let entry = state.data[state.slider];

    let date = entry[0].toISOString();
    date = date.substr(0, 10) + ' ' + date.substr(11, 5);
    $('#slider-label').text(date);

    let d = [];
    for (let i = 1; i < entry.length; i++) {
        d.push(entry[i]);
    }
    let colors = getColors(count);
    let labels = Object.keys(state.timeData).sort().map(id => state.stands[id].name);
    if (state.barChart) {
        state.barChart.data = {
            labels: labels,
            datasets: [{
                data: d,
                fill: false,
                backgroundColor: colors,
                borderColor: colors,
                borderWidth: 1
            }]
        };
        state.barChart.update();
    } else {
        Chart.defaults.global.animation.duration = 0;
        Chart.defaults.global.legend.display = false;
        state.barChart = new Chart(document.getElementById("barChart"), {
            type: "bar",
            data: {
                labels: labels,
                datasets: [{
                    data: d,
                    fill: false,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero: true,
                            suggestedMax: state.maxValue + 5
                        }
                    }]
                },
                "animation": {
                    "duration": 1,
                    "onComplete": function () {
                        var chartInstance = this.chart, ctx = chartInstance.ctx;

                        ctx.font = Chart.helpers.fontString(Chart.defaults.global.defaultFontSize, Chart.defaults.global.defaultFontStyle, Chart.defaults.global.defaultFontFamily);
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';

                        this.data.datasets.forEach(function (dataset, i) {
                            const meta = chartInstance.controller.getDatasetMeta(i);
                            meta.data.forEach(function (bar, index) {
                                let text = dataset.data[index];
                                text = text ? text.toFixed(2) : 0;
                                ctx.fillText(text, bar._model.x, bar._model.y - 5);
                            });
                        });
                    }
                },
            }
        });
    }
}

$('#timeSlider').on('input', e => {
    state.slider = e.target.value;
    updateBarChart();
});

function updateMapView() {
    const bikeStands = state.stands;
    let filteredIDs = state.filteredIDs;
    let selectedIDs = state.selectedIDs;
    const tooManySelected = selectedIDs.length > 50;

    let i = 0;
    const colors = getColors(selectedIDs.length);
    for (let key of Object.keys(bikeStands).sort()) {
        const stand = bikeStands[key];
        const hasNoFilter = !filteredIDs || !filteredIDs.length;
        const isVisible = hasNoFilter || filteredIDs.includes(stand.id);
        const isSelected = selectedIDs.includes(stand.id);

        if (isSelected) {
            let selectedColor = tooManySelected ? colorMaps.hot.single : colors[i];
            stand.marker.setStyle({
                ...style.selectedCircle,
                color: selectedColor,
                fillColor: selectedColor
            })
                .setRadius(stand.marker.options.radius);
            if (state.showPopups) {
                stand.marker.openPopup();
            }
            i++;
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

function zoomOnTimeFrame(windowMs) {
    if (state.graph) {
        const start = (state.graph.dateWindow_ && state.graph.dateWindow_[0])
            ? state.graph.dateWindow_[0] : state.graph.rawData_[0][0];
        state.graph.updateOptions({dateWindow: [start, start + windowMs]});
    }
}

function zoomOnStart(epochMs) {
    if (state.graph) {
        state.graph.updateOptions({dateWindow: [epochMs, epochMs + 2592000000]});
    }
}

function zoomOnMonth() {
    zoomOnTimeFrame(2592000000);
}

function zoomOnWeek() {
    zoomOnTimeFrame(604800000);
}

function zoomOnAllTime() {
    if (state.graph) state.graph.updateOptions({dateWindow: null});
}

$('#zoomOnMonth').click(zoomOnMonth);
$('#zoomOnWeek').click(zoomOnWeek);
$('#zoomOnAll').click(zoomOnAllTime);

function createTable() {
    const table = $('#stands').DataTable({
        dom: '<"float-left"f>rtip',
        responsive: true,
        select: true,
        scroller: true,
        deferRender: false,
        scrollY: "80vh",
        scrollCollapse: true,
        paging: true,
        columns: [{title: '<i class="fa fa-bicycle"></i> Bike Stands', data: 'name'}],
        data: [],
        order: [[0, "asc"]],
        language: {
            info: 'Showing _TOTAL_ of _MAX_ stands',
            infoFiltered: '',
            select: {
                rows: {
                    _: "%d selected"
                }
            }
        }
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

        const markerContent = stand.name;
        stand.marker = L.circle([stand.y, stand.x], style.visibleCircle)
            .addTo(map)
            .bindPopup(markerContent, {autoClose: false, closeButton: false, closeOnEscapeKey: false})
            .bindTooltip(stand.name)
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
        let useID = id;
        const alias = findAlias(id, year);
        if (alias) {
            useID = alias;
        }
        if (state.stands[useID]) {
            toSelect.push(useID);
        } else {
            state.missingSelected.push(id);
        }
    });
    state.selectedIDs = [];
    selectMany(toSelect);
    state.timeData = {};
    loadTimeDataMany(toSelect, () => {
        updateChartView();
        if (state.graph) state.graph.updateOptions({dateWindow: null});
        zoomOnMonth();
    });
    state.slider = 0;
    updateSlider();

    updateMapView();
    // Reset Zoom
    zoomOnSelected();
}

function findAlias(id, year) {
    for (let stand of state.standsById[id]) {
        if (stand.aliases && stand.aliases[year]) return stand.aliases[year];
    }
    return null;
}

function chooseLine() {
    pause();
    state.mode = Mode.LINE;
    updateModeButtons();
    updateChartView();
    if (state.slider < state.data.length) {
        zoomOnStart(state.data[state.slider][0].getTime());
    }
}

function chooseBar() {
    state.mode = Mode.BAR;
    updateModeButtons();
    updateChartView();
    if (state.graph) {
        const start = (state.graph.dateWindow_ && state.graph.dateWindow_[0])
            ? state.graph.dateWindow_[0] : state.graph.rawData_[0][0];
        let dateIndex = 0;
        for (let i = 0; i < state.data.length; i++) {
            let time = state.data[i][0].getTime();
            if (start <= time) {
                dateIndex = i;
                break;
            }
        }
        state.slider = dateIndex;
        updateSlider();
        updateBarChart();
    }
}

const lineButton = $('#choose-line');
const barButton = $('#choose-bar');

function updateModeButtons() {
    let enabledClass = 'btn-outline-primary';
    let disabledClass = 'btn-outline-secondary';
    switch (state.mode) {
        case Mode.LINE:
            lineButton.addClass(enabledClass).removeClass(disabledClass);
            barButton.removeClass(enabledClass).addClass(disabledClass);
            break;
        case Mode.BAR:
            lineButton.removeClass(enabledClass).addClass(disabledClass);
            barButton.addClass(enabledClass).removeClass(disabledClass);
            break;
        default:
            break;
    }
}

lineButton.click(chooseLine);
barButton.click(chooseBar);

const playPauseButton = $('#play-pause');

function play() {
    if (state.playing) return;
    state.playing = true;
    playPauseButton.empty().append('<i class="fa fa-pause-circle"></i> Pause');
    step();
}

function pause() {
    if (!state.playing) return;
    state.playing = false;
    playPauseButton.empty().append('<i class="fa fa-play-circle"></i> Play');
}

function togglePlay() {
    if (state.playing) {
        pause();
    } else {
        play();
    }
}

function updateSlider() {
    $('#timeSlider').val(state.slider);
}

function step() {
    try {
        if (!state.playing) {
            return;
        }
        state.slider++;
        if (state.slider >= state.data.length) {
            pause();
            return;
        }
        updateSlider();
        updateBarChart();
        setTimeout(step, 65);
    } catch (error) {
        pause();
        showAlert('Playback stopped due to error', 4000, 'danger');
        throw error;
    }
}

playPauseButton.click(togglePlay);