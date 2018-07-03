export default `
:host {
	display: grid;
	grid-template-columns: repeat(7, 1fr);
	border: 1px solid var(--border-color);
	--border-color: #aaa;
	--out-of-month-color: var(--border-color);
	/* This determines what an empty calendar would look like.
		Fraction units take care of making the calendar's rows consistent */
	--min-row-height: 1em;
	--out-of-month-background-color: #eee;
	--today-accent-color: #a972df;
	--header-background-color: transparent;
	/* --date-text-color */
}

.day-names {
	display: contents;
}

header {
	grid-column: 1 / span 7;
	background-color: var(--header-background-color);
}
	header h1 {
		margin: 0;
	}

h1 {
	margin: 0;
	display: inline-block;
}

.cells {
	display: contents;
}

.cell, .day-name {
	padding: calc(.5 * (var(--min-row-height) - 1em));
}

.cell {
	color: var(--date-text-color);
	border: 1px solid var(--border-color);
	border-left: none;
	border-bottom: none;
	z-index: 1;
	box-sizing: border-box;
	/* font-size: 12; */
}
	.cell[tabIndex="0"] {
		
	}
	/* Remove the right border on the rightmost elements because the :host already has a border.*/
	.cell:nth-of-type(7n) {
		border-right: none;
	}

	.cell:not(.in-month) {
		color: var(--out-of-month-color);
		background-color: var(--out-of-month-background-color);
	}

	.cell.today {
		outline-color: var(--today-accent-color);
		color: var(--today-accent-color);
		/* font-weight: bolder; */
		border-color: var(--today-accent-color);
		border-width: 2px;
		border-left: solid;
		border-bottom: solid;
		margin: 0 0 -1px -1px;
		z-index: 2;
	}

.slots {
	display: contents;
}
.slot-container {
	padding-right: 1px;
	/* padding: 0 2px 0 1px; */
	/* background-color: #eee; */
	/* padding: 1px; */
	z-index: 5;
	/* position: relative; */
}

`;