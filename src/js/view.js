import { h, init } from 'snabbdom';
import toVNode from 'snabbdom/es/tovnode';
import props from 'snabbdom/es/modules/props';
import Model from './model';

const patch = init([props]);

export default class View {
    constructor(container) {
        this.container = container;
        this.model = new Model(this.onChanges.bind(this));

        this.timer = setInterval(this.onTick.bind(this), 1000);

        this.renderFunc = this.render.bind(this);
        this.requestRender = 0;

        this.vnode = null;
    }

    onChanges(property, oldValue, newValue) {
        if (this.requestRender) {
            cancelAnimationFrame(this.requestRender);
        }

        this.requestRender = requestAnimationFrame(this.renderFunc);
    }

    render() {
        const { hours, minutes, seconds } = this.model;
        const newVNode = h('div', {props: { id: "wrapper"}}, [
            h('span', {}, hours), ':',
            h('span', {}, minutes), ':',
            h('span', {}, seconds)
        ]);

        if (!this.vnode) {
            this.vnode = toVNode(this.container);
        }
        this.vnode = patch(this.vnode, newVNode);

        this.requestRender = 0;
        console.log('render()');
    }

    onTick() {
        const now = new Date();

        this.model.hours = now.getHours();
        this.model.minutes = now.getMinutes();
        this.model.seconds = now.getSeconds();
    }
}
