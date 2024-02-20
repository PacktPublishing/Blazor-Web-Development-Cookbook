export function afterWebStarted(blazor) {
    blazor.registerCustomEventType('preventcopy', {
        browserEventName: 'copy',
        createEventArgs: event => {
            
            event.clipboardData.setData('text/plain', '-------');
            event.preventDefault();

            return {
                timestampUtc: new Date()
            };
        }
    });
}