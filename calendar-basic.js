"use strict";

import { html, PolymerElement } from '@polymer/polymer/polymer-element.js';

import MonthModel from "./js/month-model.js";
import shadowStyles from "./js/shadow-styles.js";

/**
 * `calendar-basic`
 * 
 *
 * @customElement
 * @polymer
 * @demo demo/index.html
 */
class CalendarBasic extends MonthModel(PolymerElement) {
	static get properties() {
		return {
			eventsPerCell: {
				type: Number,
				value: 5
			},
			lang: {
				type: String,
				value: function () {
					// Check for our own language atttribute
					let lang;
					// Check for a language attribute on a DOM parent
					let langEl = this.matches('[lang]');
					if (langEl) {
						return langEl.getAttribute('lang');
					}
					// Use the navigator's language
					else {
						return navigator.language;
					}
				}
			},
			today: {
				type: Date,
				value: new Date()
			},
			todayMin: {
				type: Date,
				computed: 'calcTodayMin(today)'
			},
			todayMax: {
				type: Date,
				computed: 'calcTodayMax(todayMin)'
			},
			weekdayNameStyle: {
				type: String,
				value: 'long'
			},
			rowsPerCell: {
				type: Number,
				computed: 'calcRowsPerCell(eventsPerCell)'
			},
			weekdayNames: {
				type: Array,
				computed: 'calcWeekdayNames(lang, weekdayNameStyle)'
			},
			dateExtractor: {
				type: Function,
				computed: 'calcDateExtractor(lang)'
			},
			basisTitleExtractor: {
				type: Function,
				computed: 'calcBasisTitleExtractor(lang)'
			},
			computedStyles: {
				type: HTMLElement,
				computed: 'calcComputedStyles(rowsPerCell)'
			},

		};
	}
	calcTodayMin(today) {
		let todayMin = new Date(today);
		todayMin.setHours(0, 0, 0, 0);
		return todayMin;
	}
	calcTodayMax(todayMin) {
		let todayMax = new Date(todayMin);
		todayMax.setDate(todayMax.getDate() + 1);
		todayMax.setHours(0, 0, 0, -1);
		return todayMax;
	}
	calcRowsPerCell(eventsPerCell) {
		// This is the total number of rows that appear in each cell.
		// The extra row per cell is for the date that appears at the top of the cell.
		return eventsPerCell + 1;
	}
	calcWeekdayNames(lang, weekdayNameStyle) {
		// Create a date formatter that will extract the weekday name, in the langauge with the style
		let weekdayNameExtractor = Intl.DateTimeFormat(lang, { 'weekday': weekdayNameStyle }).format;

		let d = new Date();
		// Track to a date that is the first day of the week
		d.setDate(d.getDate() - d.getDay());
		let names = [];
		// Iterate through a week's worth of days
		// Iterate through a week's worth of days
		for (let i = 0; i < 7; ++i) {
			names.push(weekdayNameExtractor(d));
			d.setDate(d.getDate() + 1);
		}
		return names;
	}
	calcDateExtractor(lang) {
		return Intl.DateTimeFormat(lang, { 'day': 'numeric' }).format;
	}
	calcBasisTitleExtractor(lang) {
		return Intl.DateTimeFormat(this.lang, { 'month': 'long', 'year': 'numeric' }).format;
	}
	calcComputedStyles(rowsPerCell) {
		return `.cell {
				grid-column-end: span 1;
				grid-row-end: span ${rowsPerCell};
			}
			${// TODO: Find a better way of putting all the cells into their proper locations
			// TODO: remove the hacky iteration
			(new Array(6)).fill('').map((_, row) =>
				(new Array(7)).fill('').map((_, column) => `.cell:nth-of-type(${row * 7 + column + 1}) {
							grid-column-start: ${column + 1};
							grid-row-start: ${row * rowsPerCell + 3};
						}`).join('\n')
			).join('\n')}
			:host {
				grid-template-rows: auto minmax(var(--min-row-height), 1fr) repeat(${6 * rowsPerCell}, minmax(var(--min-row-height), 1fr));
			}`;
	}


	static get template() {
		return html`
			<style>
				[[computedStyles]]
			</style>
			<header part="header">
				<h1 part="basis-title"></h1>
			</header>
			<div class="day-names" aria-role="grid">
				${html(`<div class="day-name" part="day-name" aria-role="gridcell"></div>`.repeat(7))}
			</div>
			<div class="cells">
				${html(`<div part="cell" class="cell" tabindex="-1"></div>`.repeat(7 /* columns */ * 6 /* rows */))}
			</div>
			<div class="slots"></div>
		`;
	}
	// Specify our update logic and update everything for the first time.
	hook() {
		this.elements = {};

		// Computed Styles
		this.elements.computedStyles = this.shadowRoot.querySelector('style');
		this.depends(this.updateComputedStyles.bind(this), ['computedStyles']);
		this.updateComputedStyles();

		// Weekday Names
		this.elements.weekdayNames = this.shadowRoot.querySelectorAll('.day-name');
		this.depends(this.updateWeekdayNames.bind(this), ['weekdayNames']);
		this.updateWeekdayNames();

		// Cell Classes and Dates
		this.elements.cells = this.shadowRoot.querySelectorAll('.cell');
		this.depends(this.updateCells.bind(this), ['visibleEnd', 'dateExtractor', 'todayMax']);
		this.updateCells();

		// Month title in the header
		this.elements.basisTitle = this.shadowRoot.querySelector('header h1');
		this.depends(this.updateBasisTitle.bind(this), ['visibleEnd', 'monthExtractor']);
		this.updateBasisTitle();

		// Make sure that the basis is focused as long as any element is focused
		this.depends(this.updateBasisCell.bind(this), ['basis']);
		this.updateBasisCell();

		// Place the slots and notify the elements that their slots are available
		this.elements.slotContainer = this.shadowRoot.querySelector('.slots');
		this.depends(this.placeSlots.bind(this), ['visibleEventsMeta', 'visibleStart', 'eventsPerCell']);
		this.placeSlots();


		// Start listening to the events we need
		this.shadowRoot.querySelector('.cells').addEventListener('keydown', this.handleArrowNavigation.bind(this));
		this.shadowRoot.querySelector('.cells').addEventListener('focusin', this.handleFocusChange.bind(this));
	}
	updateComputedStyles() {
		this.elements.computedStyles.innerHTML = this.computedStyles;
	}
	updateWeekdayNames() {
		this.weekdayNames.forEach((name, i) => {
			this.elements.weekdayNames[i].innerText = name;
		});
	}
	updateCells() {
		let i = 0;
		this.cell2date = new Map();
		for (let day of this.visibleDays()) {
			const cell = this.elements.cells[i++]
			this.cell2date.set(cell, new Date(day));
			cell.className = this.dateClasses(day);

			cell.innerText = this.dateExtractor(day);
		}
	}
	updateBasisTitle() {
		this.elements.basisTitle.innerText = this.basisTitleExtractor(this.basis);
	}
	updateBasisCell() {
		for (let el of this.elements.cells) {
			if (this.isSameDay(this.cell2date.get(el), this.basis)) {
				this.elements.basisCell = el;
				break;
			}
		}
		// Take any previous active element our of the tab order
		let prev = this.shadowRoot.querySelector('[tabIndex="0"]');
		if (prev) {
			prev.tabIndex = '-1';
		}
		// And put our new basis cell into the tab order
		this.elements.basisCell.tabIndex = '0';
		// Focus our basis if an element was previously focused
		if (this.shadowRoot.activeElement && this.shadowRoot.activeElement != this.elements.basisCell) {
			this.elements.basisCell.focus();
		}
	}
	dateClasses(d) {
		let classes = "cell";
		if (this.isInBasisMonth(d)) {
			classes += " in-month";
		}
		if (this.isToday(d)) {
			classes += " today";
		}
		return classes;
	}
	isInBasisMonth(d) {
		let test = new Date(this.basis);
		return d.getFullYear() == test.getFullYear() && d.getMonth() == test.getMonth();
	}
	isToday(d) {
		return d >= this.todayMin && d <= this.todayMax;
	}
	// Slot placement
	placeSlots() {
		// Remove the slots we had previously placed.
		const slots = this.elements.slotContainer;
		while (slots.firstChild) {
			slots.firstChild.remove();
		}

		// Map of the event-meta elements to the slots that we're offering them.
		let offerings = new Map();
		for (let meta of this.visibleEventsMeta) {
			offerings.set(meta, []);
		}

		// List of events which still need a home.
		let workingSet = Array.from(this.visibleEventsMeta);

		// Helper Functions
		const slotColumn = index => index % 7 + 1;
		const slotRow = (pass, index) => Math.floor(index / 7) * this.rowsPerCell + 4 + pass;

		// Used to give each slot a unique id
		let slotId = 0;
		for (let pass = 0; pass < this.eventsPerCell; ++pass) {
			for (let iterator = new Date(this.visibleStart), cellIndex = 0; cellIndex < 6 * 7;) {
				let event;
				if ((event = this.nextPlacable(workingSet, iterator))) {
					while (iterator < this.visibleEnd && iterator < event.end) {
						const slotName = 'id-' + slotId++;
						let slotContainer = document.createElement('div');
						// TODO: Need to focus the correct cell based on events that bubble through to the slot container.  Or just require the event element to handle the events that it needs.
						slotContainer.className = "slot-container";
						let slot = document.createElement('slot');
						slot.setAttribute('name', slotName);
						slotContainer.appendChild(slot);
						offerings.get(event).push(slotName);

						let startColumn = slotColumn(cellIndex);
						let startRow = slotRow(pass, cellIndex);

						let span = 1;
						iterator.setDate(iterator.getDate() + 1);
						++cellIndex;
						while (iterator < this.visibleEnd &&
							iterator < event.end &&
							slotColumn(cellIndex) > startColumn) {
							++span;
							iterator.setDate(iterator.getDate() + 1);
							++cellIndex;
						}
						slotContainer.style.gridColumn = `${startColumn} / span ${span}`;
						slotContainer.style.gridRow = `${startRow} / span 1`;

						if (pass + 1 == this.eventsPerCell) {
							let moreEl = document.createElement('div');
							moreEl.className = "more-placeholder";
							moreEl.innerHTML = "More";
							moreEl.style.gridColumn = `${startColumn} / span ${span}`;
							moreEl.style.gridRow = `${startRow} / span 1`;

							this.elements.slotContainer.appendChild(moreEl);
							continue;
						}

						// Testing content:
						slot.innerHTML = "<div>Slot hasn't been overridden</div>";

						this.elements.slotContainer.appendChild(slotContainer);
					}
				} else {
					// No event can be placed in this row of this cell
					iterator.setDate(iterator.getDate() + 1);
					++cellIndex;
				}
			}
		}
		offerings.forEach((names, eventMeta) => {
			eventMeta.offerSlots(names);
		});
	}
	nextPlacable(workingSet, date) {
		for (let i = 0; i < workingSet.length; ++i) {
			const element = workingSet[i];
			if (this.isSameDay(element.start, date)) {
				workingSet.splice(i, 1);
				return element;
			}
		}
		return undefined;
	}

	// Controller
	handleArrowNavigation(e) {
		let temp = new Date(this.basis);
		let offset;
		if (e.key == "ArrowLeft") {
			offset = -1;
		} else if (e.key == "ArrowRight") {
			offset = 1;
		} else if (e.key == "ArrowUp") {
			offset = -7
		} else if (e.key == "ArrowDown") {
			offset = 7;
		} else {
			return;
		}
		temp.setDate(temp.getDate() + offset);
		this.basis = temp;
		e.preventDefault(); // Stop from scrolling the page (Hopefully it will still scroll the focused element into view)
	}
	handleFocusChange(e) {
		this.basis = new Date(this.cell2date.get(e.target));
	}
	// TODO: Update what today is every so often
}

customElements.define("calendar-basic", CalendarBasic, {});