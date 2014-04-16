
setDefaults({
    allDaySlot: true,
    allDayText: 'all-day',
    firstHour: 6,
    slotMinutes: 30,
    slotDuration: '00:30:00',
    defaultEventMinutes: 120,
    axisFormat: generateAgendaAxisFormat,
    timeFormat: {
        agenda: generateAgendaTimeFormat
    },
    dragOpacity: {
        agenda: .5
    },
    minTime: '00:00:00',
    maxTime: '24:00:00'
});


// TODO: make it work in quirks mode (event corners, all-day height)
// TODO: test liquid width, especially in IE6

function ResourceView(element, calendar, viewName) {
    var t = this;


    // exports
    t.renderResource = renderResource;
    t.setWidth = setWidth;
    t.setHeight = setHeight;
    t.afterRender = afterRender;
    t.defaultEventEnd = defaultEventEnd;
    t.computeDateTop = computeDateTop;
    t.getIsCellAllDay = getIsCellAllDay;
    t.allDayRow = getAllDayRow;
    t.getCoordinateGrid = function() { return coordinateGrid }; // specifically for AgendaEventRenderer
    t.getHoverListener = function() { return hoverListener };
    t.colLeft = colLeft;
    t.colRight = colRight;
    t.colContentLeft = colContentLeft;
    t.colContentRight = colContentRight;
    t.getDaySegmentContainer = function() { return daySegmentContainer };
    t.getSlotSegmentContainer = function() { return slotSegmentContainer };
    t.getMinMinute = function() { return minMinute };
    t.getMaxMinute = function() { return maxMinute };
    t.getSlotContainer = function() { return slotContainer };
    t.getRowCnt = function() { return 1 };
    t.getColCnt = function() { return colCnt };
    t.getColWidth = function() { return colWidth };
    t.getSnapHeight = function() { return snapHeight };
    t.getSnapMinutes = function() { return snapMinutes };
    t.defaultSelectionEnd = defaultSelectionEnd;
    t.renderDayOverlay = renderDayOverlay;
    t.renderSelection = renderSelection;
    t.clearSelection = clearSelection;
    t.reportDayClick = reportDayClick; // selection mousedown hack
    t.dragStart = dragStart;
    t.dragStop = dragStop;
    t.getResources = calendar.fetchResources();

    // imports
    View.call(t, element, calendar, viewName);
    OverlayManager.call(t);
    SelectionManager.call(t);
    ResourceEventRenderer.call(t);
    var opt = t.opt;
    var trigger = t.trigger;
    var renderOverlay = t.renderOverlay;
    var clearOverlays = t.clearOverlays;
    var reportSelection = t.reportSelection;
    var unselect = t.unselect;
    var daySelectionMousedown = t.daySelectionMousedown;
    var slotSegHtml = t.slotSegHtml;
    var cellToDate = t.cellToDate;
    var dateToCell = t.dateToCell;
    var rangeToSegments = t.rangeToSegments;
    var formatDate = calendar.formatDate;


    // locals

    var dayTable;
    var dayHead;
    var dayHeadCells;
    var dayBody;
    var dayBodyCells;
    var dayBodyCellInners;
    var dayBodyCellContentInners;
    var dayBodyFirstCell;
    var dayBodyFirstCellStretcher;
    var slotLayer;
    var daySegmentContainer;
    var allDayTable;
    var allDayRow;
    var slotScroller;
    var slotContainer;
    var slotSegmentContainer;
    var slotTable;
    var slotTableFirstInner;
    var selectionHelper;

    var viewWidth;
    var viewHeight;
    var axisWidth;
    var colWidth;
    var gutterWidth;
    var slotDuration;
    var slotHeight; // TODO: what if slotHeight changes? (see issue 650)

    var snapMinutes;
    var snapRatio; // ratio of number of "selection" slots to normal slots. (ex: 1, 2, 4)
    var snapHeight; // holds the pixel hight of a "selection" slot

    var colCnt;
    var slotCnt;
    var coordinateGrid;
    var hoverListener;
    var colPositions;
    var colContentPositions;
    var slotTopCache = {};

    var tm;
    var rtl;
    var minMinute, maxMinute;
    var colFormat;
    var showWeekNumbers;
    var weekNumberTitle;
    var weekNumberFormat;
    var resources = t.getResources;


    /* Rendering
     -----------------------------------------------------------------------------*/


    disableTextSelection(element.addClass('fc-agenda'));


    function renderResource(c) {
        colCnt = c;
        updateOptions();

        if (!dayTable) { // first time rendering?
            buildSkeleton(); // builds day table, slot area, events containers
        }
        else {
            buildDayTable(); // rebuilds day table
        }
    }


    function updateOptions() {

        tm = opt('theme') ? 'ui' : 'fc';
        rtl = opt('isRTL')
        minMinute = moment.duration(opt('minTime'));
        maxMinute = moment.duration(opt('maxTime'));
        colFormat = opt('columnFormat');
        slotDuration = moment.duration(opt('slotDuration'));

        // week # options. (TODO: bad, logic also in other views)
        showWeekNumbers = opt('weekNumbers');
        weekNumberTitle = opt('weekNumberTitle');
        if (opt('weekNumberCalculation') != 'iso') {
            weekNumberFormat = "w";
        }
        else {
            weekNumberFormat = "W";
        }

        snapMinutes = opt('snapMinutes') || opt('slotMinutes');
    }



    /* Build DOM
     -----------------------------------------------------------------------*/


    function buildSkeleton() {
        var headerClass = tm + "-widget-header";
        var contentClass = tm + "-widget-content";
        var s;
        var d;
        var i;
        var maxd;
        var minutes;
        var slotNormal = opt('slotMinutes') % 15 == 0;

        buildDayTable();

        slotLayer =
            $("<div style='position:absolute;z-index:2;left:0;width:100%'/>")
                .appendTo(element);

        if (opt('allDaySlot')) {

            daySegmentContainer =
                $("<div class='fc-event-container' style='position:absolute;z-index:8;top:0;left:0'/>")
                    .appendTo(slotLayer);

            s =
                "<table style='width:100%' class='fc-agenda-allday' cellspacing='0'>" +
                    "<tr>" +
                    "<th class='" + headerClass + " fc-agenda-axis'>" + opt('allDayText') + "</th>" +
                    "<td>" +
                    "<div class='fc-day-content'><div style='position:relative'/></div>" +
                    "</td>" +
                    "<th class='" + headerClass + " fc-agenda-gutter'>&nbsp;</th>" +
                    "</tr>" +
                    "</table>";
            allDayTable = $(s).appendTo(slotLayer);
            allDayRow = allDayTable.find('tr');

            dayBind(allDayRow.find('td'));

            slotLayer.append(
                "<div class='fc-agenda-divider " + headerClass + "'>" +
                    "<div class='fc-agenda-divider-inner'/>" +
                    "</div>"
            );

        }else{

            daySegmentContainer = $([]); // in jQuery 1.4, we can just do $()

        }

        slotScroller =
            $("<div style='position:absolute;width:100%;overflow-x:hidden;overflow-y:auto'/>")
                .appendTo(slotLayer);

        slotContainer =
            $("<div style='position:relative;width:100%;overflow:hidden'/>")
                .appendTo(slotScroller);

        slotSegmentContainer =
            $("<div class='fc-event-container' style='position:absolute;z-index:8;top:0;left:0'/>")
                .appendTo(slotContainer);

        s =
            "<table class='fc-agenda-slots' style='width:100%' cellspacing='0'>" +
                "<tbody>";
        var slotTime = moment.duration(+minMinute); // i wish there was .clone() for durations
        slotCnt = 0;
        while (slotTime < maxMinute) {
            var slotDate = t.start.clone().time(slotTime); // will be in UTC but that's good. to avoid DST issues
            minutes = slotDate.minutes();
            s +=
                "<tr class='fc-slot" + slotCnt + ' ' + (!minutes ? '' : 'fc-minor') + "'>" +
                    "<th class='fc-agenda-axis " + headerClass + "'>" +
                    ((!slotNormal || !minutes) ?
                        htmlEscape(formatDate(slotDate, opt('axisFormat'))) :
                        '&nbsp;'
                        ) +
                    "</th>" +
                    "<td class='" + contentClass + "'>" +
                    "<div style='position:relative'>&nbsp;</div>" +
                    "</td>" +
                    "</tr>";
            slotTime.add(slotDuration);
            slotCnt++;
        }
        s +=
            "</tbody>" +
                "</table>";
        slotTable = $(s).appendTo(slotContainer);
        slotTableFirstInner = slotTable.find('div:first');

        slotBind(slotTable.find('td'));
    }



    /* Build Day Table
     -----------------------------------------------------------------------*/


    function buildDayTable() {
        var html = buildDayTableHTML();

        if (dayTable) {
            dayTable.remove();
        }
        dayTable = $(html).appendTo(element);

        dayHead = dayTable.find('thead');
        dayHeadCells = dayHead.find('th').slice(1, -1); // exclude gutter
        dayBody = dayTable.find('tbody');
        dayBodyCells = dayBody.find('td').slice(0, -1); // exclude gutter
        dayBodyCellInners = dayBodyCells.find('> div');
        dayBodyCellContentInners = dayBodyCells.find('.fc-day-content > div');

        dayBodyFirstCell = dayBodyCells.eq(0);
        dayBodyFirstCellStretcher = dayBodyCellInners.eq(0);

        markFirstLast(dayHead.add(dayHead.find('tr')));
        markFirstLast(dayBody.add(dayBody.find('tr')));

        // TODO: now that we rebuild the cells every time, we should call dayRender
    }


    function buildDayTableHTML() {
        var html =
            "<table style='width:100%' class='fc-agenda-days fc-border-separate' cellspacing='0'>" +
                buildDayTableHeadHTML() +
                buildDayTableBodyHTML() +
                "</table>";

        return html;
    }


    function buildDayTableHeadHTML() {
        var headerClass = tm + "-widget-header";
        var date;
        var html = '';
        var weekText;
        var col;

        html +=
            "<thead>" +
                "<tr>";

        if (showWeekNumbers) {
            weekText = formatDate(date, weekNumberFormat);
            if (rtl) {
                weekText += weekNumberTitle;
            }
            else {
                weekText = weekNumberTitle + weekText;
            }
            html +=
                "<th class='fc-agenda-axis fc-week-number " + headerClass + "'>" +
                    htmlEscape(weekText) +
                    "</th>";
        }
        else {
            html += "<th class='fc-agenda-axis " + headerClass + "'>&nbsp;</th>";
        }

        for (col=0; col<colCnt; col++) {
            var classNames = [
                'fc-col' + col,
                resources[col].className,
                headerClass
            ];

            html +=
                "<th class='" + classNames.join(' ') + "'>" +
                    htmlEscape(resources[col].name) +
                    "</th>";
        }

        html +=
            "<th class='fc-agenda-gutter " + headerClass + "'>&nbsp;</th>" +
                "</tr>" +
                "</thead>";

        return html;
    }


    function buildDayTableBodyHTML() {
        var headerClass = tm + "-widget-header"; // TODO: make these when updateOptions() called
        var contentClass = tm + "-widget-content";
        var date;
        var today = calendar.getNow().stripTime();
        var col;
        var cellsHTML;
        var cellHTML;
        var classNames;
        var html = '';

        html +=
            "<tbody>" +
                "<tr>" +
                "<th class='fc-agenda-axis " + headerClass + "'>&nbsp;</th>";

        cellsHTML = '';

        for (col=0; col<colCnt; col++) {

            date = t.visStart.clone();

            classNames = [
                'fc-col' + col,
                resources[col].className,
                contentClass
            ];
            if (+date == +today) {
                classNames.push(
                    tm + '-state-highlight',
                    'fc-today'
                );
            }
            else if (date < today) {
                classNames.push('fc-past');
            }
            else {
                classNames.push('fc-future');
            }

            cellHTML =
                "<td class='" + classNames.join(' ') + "'>" +
                    "<div>" +
                    "<div class='fc-day-content'>" +
                    "<div style='position:relative'>&nbsp;</div>" +
                    "</div>" +
                    "</div>" +
                    "</td>";

            cellsHTML += cellHTML;
        }

        html += cellsHTML;
        html +=
            "<td class='fc-agenda-gutter " + contentClass + "'>&nbsp;</td>" +
                "</tr>" +
                "</tbody>";

        return html;
    }


    // TODO: data-date on the cells



    /* Dimensions
     -----------------------------------------------------------------------*/


    function setHeight(height) {
        if (height === undefined) {
            height = viewHeight;
        }
        viewHeight = height;
        slotTopCache = {};

        var headHeight = dayBody.position().top;
        var allDayHeight = slotScroller.position().top; // including divider
        var bodyHeight = Math.min( // total body height, including borders
            height - headHeight,   // when scrollbars
            slotTable.height() + allDayHeight + 1 // when no scrollbars. +1 for bottom border
        );

        dayBodyFirstCellStretcher
            .height(bodyHeight - vsides(dayBodyFirstCell));

        slotLayer.css('top', headHeight);

        slotScroller.height(bodyHeight - allDayHeight - 1);

        slotHeight = slotTableFirstInner.height() + 1; // +1 for border

        snapRatio = opt('slotMinutes') / snapMinutes;
        snapHeight = slotHeight / snapRatio;
    }


    function setWidth(width) {
        viewWidth = width;
        colPositions.clear();
        colContentPositions.clear();

        var axisFirstCells = dayHead.find('th:first');
        if (allDayTable) {
            axisFirstCells = axisFirstCells.add(allDayTable.find('th:first'));
        }
        axisFirstCells = axisFirstCells.add(slotTable.find('th:first'));

        axisWidth = 0;
        setOuterWidth(
            axisFirstCells
                .width('')
                .each(function(i, _cell) {
                    axisWidth = Math.max(axisWidth, $(_cell).outerWidth());
                }),
            axisWidth
        );

        var gutterCells = dayTable.find('.fc-agenda-gutter');
        if (allDayTable) {
            gutterCells = gutterCells.add(allDayTable.find('th.fc-agenda-gutter'));
        }

        var slotTableWidth = slotScroller[0].clientWidth; // needs to be done after axisWidth (for IE7)

        gutterWidth = slotScroller.width() - slotTableWidth;
        if (gutterWidth) {
            setOuterWidth(gutterCells, gutterWidth);
            gutterCells
                .show()
                .prev()
                .removeClass('fc-last');
        }else{
            gutterCells
                .hide()
                .prev()
                .addClass('fc-last');
        }

        colWidth = Math.floor((slotTableWidth - axisWidth) / colCnt);
        setOuterWidth(dayHeadCells.slice(0, -1), colWidth);
    }



    /* Scrolling
     -----------------------------------------------------------------------*/


    function resetScroll() {
        var top = computeTimeTop(
            moment.duration(opt('scrollTime'))
        ) + 1; // +1 for the border

        function scroll() {
            slotScroller.scrollTop(top);
        }

        scroll();
        setTimeout(scroll, 0); // overrides any previous scroll state made by the browser
    }


    function afterRender() { // after the view has been freshly rendered and sized
        resetScroll();
    }



    /* Slot/Day clicking and binding
     -----------------------------------------------------------------------*/


    function dayBind(cells) {
        cells.click(slotClick)
            .mousedown(daySelectionMousedown);
    }


    function slotBind(cells) {
        cells.click(slotClick)
            .mousedown(slotSelectionMousedown);
    }


    function slotClick(ev) {
        if (!opt('selectable')) { // if selectable, SelectionManager will worry about dayClick
            var col = Math.min(colCnt-1, Math.floor((ev.pageX - dayTable.offset().left - axisWidth) / colWidth));
            var date = cellToDate(0, 0);
            var rowMatch = this.parentNode.className.match(/fc-slot(\d+)/); // TODO: maybe use data
            if (rowMatch) {
                var mins = parseInt(rowMatch[1]) * opt('slotMinutes');
                var hours = Math.floor(mins/60);
                date.setHours(hours);
                date.setMinutes(mins%60 + minMinute);
                trigger('dayClick', dayBodyCells[col], date, false, ev);
            }else{
                trigger('dayClick', dayBodyCells[col], date, true, ev);
            }
        }
    }



    /* Semi-transparent Overlay Helpers
     -----------------------------------------------------*/
    // TODO: should be consolidated with BasicView's methods


    function renderDayOverlay(overlayStart, overlayEnd, refreshCoordinateGrid) { // overlayEnd is exclusive

        if (refreshCoordinateGrid) {
            coordinateGrid.build();
        }

        var segments = rangeToSegments(overlayStart, overlayEnd);

        for (var i=0; i<segments.length; i++) {
            var segment = segments[i];
            dayBind(
                renderCellOverlay(
                    segment.row,
                    segment.leftCol,
                    segment.row,
                    segment.rightCol
                )
            );
        }
    }


    function renderCellOverlay(row0, col0, row1, col1) { // only for all-day?
        var rect = coordinateGrid.rect(row0, col0, row1, col1, slotLayer);
        return renderOverlay(rect, slotLayer);
    }


    function renderSlotOverlay(overlayStart, overlayEnd) {

        // normalize, because dayStart/dayEnd have stripped time+zone
        overlayStart = overlayStart.clone().stripZone();
        overlayEnd = overlayEnd.clone().stripZone();

        for (var i=0; i<colCnt; i++) { // loop through the day columns

            var dayStart = cellToDate(0, i);
            var dayEnd = dayStart.clone().add('days', 1);

            var stretchStart = dayStart < overlayStart ? overlayStart : dayStart; // the max of the two
            var stretchEnd = dayEnd < overlayEnd ? dayEnd : overlayEnd; // the min of the two

            if (stretchStart < stretchEnd) {
                var rect = coordinateGrid.rect(0, i, 0, i, slotContainer); // only use it for horizontal coords
                var top = computeDateTop(stretchStart, dayStart);
                var bottom = computeDateTop(stretchEnd, dayStart);

                rect.top = top;
                rect.height = bottom - top;
                slotBind(
                    renderOverlay(rect, slotContainer)
                );
            }
        }
    }



    /* Coordinate Utilities
     -----------------------------------------------------------------------------*/


    coordinateGrid = new CoordinateGrid(function(rows, cols) {
        var e, n, p;
        dayHeadCells.each(function(i, _e) {
            e = $(_e);
            n = e.offset().left;
            if (i) {
                p[1] = n;
            }
            p = [n];
            cols[i] = p;
        });
        p[1] = n + e.outerWidth();
        if (opt('allDaySlot')) {
            e = allDayRow;
            n = e.offset().top;
            rows[0] = [n, n+e.outerHeight()];
        }
        var slotTableTop = slotContainer.offset().top;
        var slotScrollerTop = slotScroller.offset().top;
        var slotScrollerBottom = slotScrollerTop + slotScroller.outerHeight();
        function constrain(n) {
            return Math.max(slotScrollerTop, Math.min(slotScrollerBottom, n));
        }
        for (var i=0; i<slotCnt*snapRatio; i++) { // adapt slot count to increased/decreased selection slot count
            rows.push([
                constrain(slotTableTop + snapHeight*i),
                constrain(slotTableTop + snapHeight*(i+1))
            ]);
        }
    });


    hoverListener = new HoverListener(coordinateGrid);

    colPositions = new HorizontalPositionCache(function(col) {
        return dayBodyCellInners.eq(col);
    });

    colContentPositions = new HorizontalPositionCache(function(col) {
        return dayBodyCellContentInners.eq(col);
    });


    function colLeft(col) {
        return colPositions.left(col);
    }


    function colContentLeft(col) {
        return colContentPositions.left(col);
    }


    function colRight(col) {
        return colPositions.right(col);
    }


    function colContentRight(col) {
        return colContentPositions.right(col);
    }


    function getIsCellAllDay(cell) {
        return opt('allDaySlot') && !cell.row;
    }


    function realCellToDate(cell) { // ugh "real" ... but blame it on our abuse of the "cell" system
        var d = cellToDate(0, cell.col);
        var slotIndex = cell.row;
        if (opt('allDaySlot')) {
            slotIndex--;
        }
        if (slotIndex >= 0) {
            d.add('minute', minMinute + slotIndex * snapMinutes);
        }
        return d;
    }


    function computeTimeTop(time) { // time is a duration

        if (time < minMinute) {
            return 0;
        }
        if (time >= maxMinute) {
            return slotTable.height();
        }

        var slots = (time - minMinute) / slotDuration;
        var slotIndex = Math.floor(slots);
        var slotPartial = slots - slotIndex;
        var slotTop = slotTopCache[slotIndex];

        // find the position of the corresponding <tr>
        // need to use this technique because not all rows are rendered at same height sometimes.
        if (slotTop === undefined) {
            slotTop = slotTopCache[slotIndex] =
                slotTable.find('tr').eq(slotIndex).find('td div')[0].offsetTop;
            // .eq() is faster than ":eq()" selector
            // [0].offsetTop is faster than .position().top (do we really need this optimization?)
            // a better optimization would be to cache all these divs
        }

        var top =
            slotTop - 1 + // because first row doesn't have a top border
                slotPartial * slotHeight; // part-way through the row

        top = Math.max(top, 0);

        return top;
    }

    function computeDateTop(date, startOfDayDate) {
        return computeTimeTop(
            moment.duration(
                    date.clone().stripZone() - startOfDayDate.clone().stripTime()
            )
        );
    }


    function computeTimeTop(time) { // time is a duration

        if (time < minMinute) {
            return 0;
        }
        if (time >= maxMinute) {
            return slotTable.height();
        }

        var slots = (time - minMinute) / slotDuration;
        var slotIndex = Math.floor(slots);
        var slotPartial = slots - slotIndex;
        var slotTop = slotTopCache[slotIndex];

        // find the position of the corresponding <tr>
        // need to use this technique because not all rows are rendered at same height sometimes.
        if (slotTop === undefined) {
            slotTop = slotTopCache[slotIndex] =
                slotTable.find('tr').eq(slotIndex).find('td div')[0].offsetTop;
            // .eq() is faster than ":eq()" selector
            // [0].offsetTop is faster than .position().top (do we really need this optimization?)
            // a better optimization would be to cache all these divs
        }

        var top =
            slotTop - 1 + // because first row doesn't have a top border
            slotPartial * slotHeight; // part-way through the row

        top = Math.max(top, 0);

        return top;
    }


    function getAllDayRow(index) {
        return allDayRow;
    }


    function defaultEventEnd(event) {
        var start = event.start.clone();
        if (event.allDay) {
            return start;
        }
        return start.clone.add('minutes', opt('defaultEventMinutes'));
    }



    /* Selection
     ---------------------------------------------------------------------------------*/


    function defaultSelectionEnd(startDate, allDay) {
        if (allDay) {
            return startDate.clone();
        }
        return startDate.clone().add('minutes', opt('slotMinutes'));
    }


    function renderSelection(startDate, endDate, allDay) { // only for all-day
        if (allDay) {
            if (opt('allDaySlot')) {
                renderDayOverlay(startDate, endDate.clone().add('days', 1), true);
            }
        }else{
            renderSlotSelection(startDate, endDate);
        }
    }


    function renderSlotSelection(startDate, endDate) {
        var helperOption = opt('selectHelper');
        coordinateGrid.build();
        if (helperOption) {
            var col = dateToCell(startDate).col;
            if (col >= 0 && col < colCnt) { // only works when times are on same day
                var rect = coordinateGrid.rect(0, col, 0, col, slotContainer); // only for horizontal coords
                var top = computeDateTop(startDate, startDate);
                var bottom = computeDateTop(endDate, startDate);
                if (bottom > top) { // protect against selections that are entirely before or after visible range
                    rect.top = top;
                    rect.height = bottom - top;
                    rect.left += 2;
                    rect.width -= 5;
                    if ($.isFunction(helperOption)) {
                        var helperRes = helperOption(startDate, endDate);
                        if (helperRes) {
                            rect.position = 'absolute';
                            selectionHelper = $(helperRes)
                                .css(rect)
                                .appendTo(slotContainer);
                        }
                    }else{
                        rect.isStart = true; // conside rect a "seg" now
                        rect.isEnd = true;   //
                        selectionHelper = $(slotSegHtml(
                            {
                                title: '',
                                start: startDate,
                                end: endDate,
                                className: ['fc-select-helper'],
                                editable: false
                            },
                            rect
                        ));
                        selectionHelper.css('opacity', opt('dragOpacity'));
                    }
                    if (selectionHelper) {
                        slotBind(selectionHelper);
                        slotContainer.append(selectionHelper);
                        setOuterWidth(selectionHelper, rect.width, true); // needs to be after appended
                        setOuterHeight(selectionHelper, rect.height, true);
                    }
                }
            }
        }else{
            renderSlotOverlay(startDate, endDate);
        }
    }


    function clearSelection() {
        clearOverlays();
        if (selectionHelper) {
            selectionHelper.remove();
            selectionHelper = null;
        }
    }


    function slotSelectionMousedown(ev) {
        if (ev.which == 1 && opt('selectable')) { // ev.which==1 means left mouse button
            unselect(ev);
            var dates;
            hoverListener.start(function(cell, origCell) {
                clearSelection();
                if (cell && cell.col == origCell.col && !getIsCellAllDay(cell)) {
                    var d1 = realCellToDate(origCell);
                    var d2 = realCellToDate(cell);
                    dates = [
                        d1,
                        d1.clone().add('minutes', snapMinutes), // calculate minutes depending on selection slot minutes
                        d2,
                        d2.clone().add('minutes', snapMinutes)
                    ].sort(dateCompare);
                    renderSlotSelection(dates[0], dates[3]);
                }else{
                    dates = null;
                }
            }, ev);
            $(document).one('mouseup', function(ev) {
                hoverListener.stop();
                if (dates) {
                    if (+dates[0] == +dates[1]) {
                        reportDayClick(dates[0], false, ev);
                    }
                    reportSelection(dates[0], dates[3], false, ev);
                }
            });
        }
    }


    function reportDayClick(date, allDay, ev) {
        trigger('dayClick', dayBodyCells[dateToCell(date).col], date, allDay, ev);
    }



    /* External Dragging
     --------------------------------------------------------------------------------*/


    function dragStart(_dragElement, ev, ui) {
        hoverListener.start(function(cell) {
            clearOverlays();
            if (cell) {
                if (getIsCellAllDay(cell)) {
                    renderCellOverlay(cell.row, cell.col, cell.row, cell.col);
                }else{
                    var d1 = realCellToDate(cell);
                    var d2 = d1.clone().add('minutes', opt('defaultEventMinutes'));
                    renderSlotOverlay(d1, d2);
                }
            }
        }, ev);
    }


    function dragStop(_dragElement, ev, ui) {
        var cell = hoverListener.stop();
        clearOverlays();
        if (cell) {
            trigger('drop', _dragElement, realCellToDate(cell), getIsCellAllDay(cell), ev, ui);
        }
    }


}