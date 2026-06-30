/** @odoo-module **/

import { Component } from "@odoo/owl";

export class CardMetric extends Component {
    static template = "dynamic_dashboard_18.CardMetric";
    static props = {
        comp: Object,
        onCardClick: { type: Function, optional: true },
    };

    get formattedValue() {
        const val = this.props.comp.value ?? 0;
        if (typeof val !== "number") return val;
        // Format with thousand separators
        return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(val);
    }

    get cardClass() {
        const style = this.props.comp.card_style || "solid";
        return `dd-card dd-card--${style}`;
    }

    get cardStyle() {
        const rawColor = this.props.comp.color || "#4F46E5";
        const color = rawColor.startsWith("#") ? rawColor : "#" + rawColor;
        
        let rgbStr = "79, 70, 229";
        const hex = color.replace("#", "");
        if (hex.length === 6) {
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            rgbStr = `${r}, ${g}, ${b}`;
        } else if (hex.length === 3) {
            const r = parseInt(hex.substring(0, 1) + hex.substring(0, 1), 16);
            const g = parseInt(hex.substring(1, 2) + hex.substring(1, 2), 16);
            const b = parseInt(hex.substring(2, 3) + hex.substring(2, 3), 16);
            rgbStr = `${r}, ${g}, ${b}`;
        }
        
        return `--dd-card-color: ${color}; --dd-card-color-rgb: ${rgbStr};`;
    }

    get isClickable() {
        return !!this.props.comp.click_action_id && !!this.props.onCardClick;
    }

    handleClick() {
        if (this.isClickable) {
            this.props.onCardClick();
        }
    }
}
