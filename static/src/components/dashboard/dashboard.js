/** @odoo-module **/

import { Component, useState, onWillStart, onMounted, useRef } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { rpc } from "@web/core/network/rpc";
import { CardMetric } from "../card_metric/card_metric";
import { ChartWidget } from "../chart_widget/chart_widget";
import { registry } from "@web/core/registry";

export class DynamicDashboard extends Component {
    static template = "dynamic_dashboard_18.DashboardView";
    static components = { CardMetric, ChartWidget };

    setup() {
        this.rpc = rpc;
        this.notification = useService("notification");
        this.action = useService("action");

        this.gridCardsRef = useRef("gridCards");
        this.gridChartsRef = useRef("gridCharts");

        this.state = useState({
            boardData: null,
            loading: true,
            error: null,
            editMode: false,
            canEdit: false,
        });

        onWillStart(() => this._loadDashboard());
        onMounted(() => {
            if (this.state.boardData) {
                this._initSortable();
            }
        });
    }

    get boardId() {
        return this.props.boardId || this.props.action?.context?.board_id;
    }

    get cards() {
        if (!this.state.boardData?.components) return [];
        return this.state.boardData.components.filter(c => c.type === 'card_count' || c.type === 'card_sum');
    }

    get hasCards() {
        return this.cards.length > 0;
    }

    get charts() {
        if (!this.state.boardData?.components) return [];
        return this.state.boardData.components.filter(c => c.type === 'chart');
    }

    get hasCharts() {
        return this.charts.length > 0;
    }

    async _loadDashboard() {
        if (!this.boardId) {
            this.state.error = "No dashboard configured for this menu.";
            this.state.loading = false;
            return;
        }
        try {
            const data = await this.rpc(`/dynamic_dashboard_18/get_data/${this.boardId}`, {});
            if (data.error) {
                this.state.error = data.error;
            } else {
                this.state.boardData = data;
                this.state.canEdit = data.can_edit;
            }
        } catch (e) {
            this.state.error = "Failed to load dashboard. Please refresh.";
            console.error(e);
        } finally {
            this.state.loading = false;
        }
    }

    _initSortable() {
        if (!this.state.canEdit) return;

        // Dynamically load SortableJS from CDN if not already available
        if (typeof Sortable === "undefined") {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.2/Sortable.min.js";
            script.onload = () => this._createSortables();
            document.head.appendChild(script);
        } else {
            this._createSortables();
        }
    }

    _createSortables() {
        if (typeof Sortable === "undefined") return;

        const cardsEl = this.gridCardsRef?.el;
        if (cardsEl) {
            this._sortableCards = Sortable.create(cardsEl, {
                animation: 200,
                handle: ".dd-drag-handle",
                ghostClass: "dd-ghost",
                chosenClass: "dd-chosen",
                onEnd: () => this._saveLayout(),
            });
        }

        const chartsEl = this.gridChartsRef?.el;
        if (chartsEl) {
            this._sortableCharts = Sortable.create(chartsEl, {
                animation: 200,
                handle: ".dd-drag-handle",
                ghostClass: "dd-ghost",
                chosenClass: "dd-chosen",
                onEnd: () => this._saveLayout(),
            });
        }
    }

    async _saveLayout() {
        const cardItems = this.gridCardsRef.el ? [...this.gridCardsRef.el.querySelectorAll(".dd-component")] : [];
        const chartItems = this.gridChartsRef.el ? [...this.gridChartsRef.el.querySelectorAll(".dd-component")] : [];
        const items = [...cardItems, ...chartItems].map((el, idx) => ({
            id: parseInt(el.dataset.compId),
            x: parseInt(el.dataset.x || 0),
            y: idx,   // global row order after drag
            w: parseInt(el.dataset.w || 4),
            h: parseInt(el.dataset.h || 2),
        }));
        try {
            await this.rpc("/dynamic_dashboard_18/save_layout", {
                board_id: this.boardId,
                layout: items,
            });
        } catch (e) {
            console.error("Failed to save layout", e);
        }
    }

    toggleEditMode() {
        this.state.editMode = !this.state.editMode;
    }

    openAddComponent() {
        this.action.doAction({
            type: "ir.actions.act_window",
            name: "Add Component",
            res_model: "dashboard.component",
            views: [[false, "form"]],
            target: "new",
            context: {
                default_board_id: this.boardId,
            },
        }, {
            onClose: async () => {
                await this._loadDashboard();
            },
        });
    }

    openEditComponent(comp) {
        this.action.doAction({
            type: "ir.actions.act_window",
            name: "Edit Component",
            res_model: "dashboard.component",
            res_id: comp.id,
            views: [[false, "form"]],
            target: "new",
        }, {
            onClose: async () => {
                await this._loadDashboard();
            },
        });
    }

    async deleteComponent(compId) {
        if (!confirm("Delete this component?")) return;
        try {
            await this.rpc("/dynamic_dashboard_18/delete_component", { component_id: compId });
            await this._loadDashboard();
            this.notification.add("Component deleted.", { type: "info" });
        } catch (e) {
            this.notification.add("Failed to delete component.", { type: "danger" });
        }
    }

    async refreshComponent(comp) {
        try {
            const data = await this.rpc("/dynamic_dashboard_18/refresh_component", {
                component_id: comp.id,
            });
            // Replace the component in state
            const idx = this.state.boardData.components.findIndex(c => c.id === comp.id);
            if (idx !== -1) {
                this.state.boardData.components[idx] = data;
            }
        } catch (e) {
            console.error("Refresh failed", e);
        }
    }

    onCardClick(comp) {
        let parsedDomain = [];
        if (comp.click_domain) {
            try {
                parsedDomain = JSON.parse(comp.click_domain);
            } catch (e) {
                parsedDomain = comp.click_domain;
            }
        }

        if (comp.click_action_id) {
            this.action.doAction({
                type: "ir.actions.act_window",
                id: comp.click_action_id,
                domain: parsedDomain,
            });
        } else if (comp.click_model) {
            this.action.doAction({
                type: "ir.actions.act_window",
                name: comp.label || comp.name,
                res_model: comp.click_model,
                views: [[false, "list"], [false, "form"]],
                domain: parsedDomain,
                target: "current",
            });
        }
    }

    onChartClick(comp, label) {
        if (!comp.click_model) return;

        let parsedDomain = [];
        if (comp.click_domain) {
            try {
                parsedDomain = JSON.parse(comp.click_domain);
            } catch (e) {
                parsedDomain = comp.click_domain;
            }
        }

        if (comp.group_by_field && typeof parsedDomain === "object" && Array.isArray(parsedDomain)) {
            let labelValue = label;
            if (label === "N/A") {
                labelValue = false;
            }
            parsedDomain.push([comp.group_by_field, "=", labelValue]);
        }

        this.action.doAction({
            type: "ir.actions.act_window",
            name: `${comp.label || comp.name}: ${label}`,
            res_model: comp.click_model,
            views: [[false, "list"], [false, "form"]],
            domain: parsedDomain,
            target: "current",
        });
    }
}

// Register as a client action so it can be linked to menus
registry.category("actions").add("dynamic_dashboard_18.DashboardClientAction", DynamicDashboard);
