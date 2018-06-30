"use strict";

import PropertyMixin from "./property-mixin.js";

import EventBasic from "./event-basic.js";

export default class EventMeta extends PropertyMixin(HTMLElement) {
	constructor() {
		super();

		this.elements = [];
	}
	get start() {
		return new Date(this.getAttribute('start'));
	}
	get end() {
		return new Date(this.getAttribute('end'));
	}
	get title() {
		return this.innerText;
	}
	offerSlots(names) {
		let nameIndex = 0;
		// Reuse existing children
		for (let i = 0; i < this.elements.length; ++i) {
			const el = this.elements[i];
			if (nameIndex < names.length) {
				el.setAttribute('slot', names[nameIndex++]);
			} else {
				this.elements.splice(this.elements.indexOf(el), 1);
				el.remove();
			}
		}
		for (; nameIndex < names.length; ++nameIndex) {
			let el = new EventBasic();
			el.setAttribute('slot', names[nameIndex]);
			this.parentElement.appendChild(el);
			this.elements.push(el);
		}
	}
}

customElements.define('event-meta', EventMeta, {});