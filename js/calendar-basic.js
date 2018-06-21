"use strict";

import MonthGridView from "./month-grid-view.js";

const CalendarBasic = MonthGridView(HTMLElement);
export default CalendarBasic;

customElements.define("calendar-basic", CalendarBasic, {});