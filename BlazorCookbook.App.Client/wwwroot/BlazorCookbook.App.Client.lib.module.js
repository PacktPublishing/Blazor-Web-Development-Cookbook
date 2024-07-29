export function afterWebStarted(blazor) {
    blazor.registerCustomEventType('preventcopy', {
        browserEventName: 'copy',
        createEventArgs: event => {
            
            event.clipboardData.setData('text/plain', '-------');
            event.preventDefault();

            return {
                stamp: new Date()
            };
        }
    });
}

window.browserStorage = {
    get: function (type, key) {
        if (type === 'sessionStorage') {
            return sessionStorage.getItem(key);
        }
        if (type === 'localStorage') {
            return localStorage.getItem(key);
        }
        return '';
    },

    set: function (type, key, value) {
        if (type === 'sessionStorage') {
            sessionStorage.setItem(key, value);
        }
        if (type == 'localStorage') {
            localStorage.setItem(key, value);
        }
    }
};