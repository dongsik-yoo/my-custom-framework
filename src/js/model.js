
const predefinedProps = ['hours', 'minutes', 'seconds'];

export default class Model {
    constructor(callback) {
        const proxy = new Proxy(this, {
            get(target, property) {
                return target[property];
            },
            set(target, property, value) {
                const oldValue = target[property];
                target[property] = value;

                // Notify model changes if value is changed.
                if (value !== oldValue && callback) {
                    callback(property, oldValue, value);
                }

                // Return true if successful. In strict mode, returning false will throw a TypeError exception.
                return true;
            }
        });

        return proxy;
    }
}
