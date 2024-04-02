using Microsoft.JSInterop;
using System.Text.Json;

namespace BlazorCookbook.App.Client.Chapters.Chapter05.Recipe06;

public class BrowserStorage
{
    private const string _getFunc = "browserStorage.get";

    private const string
        _setFunc = "browserStorage.set",
        _local = "localStorage",
        _session = "sessionStorage";

    private readonly IJSRuntime _js;

    public BrowserStorage(IJSRuntime js)
    {
        _js = js;
    }

    public ValueTask PersistAsync<T>(StorageValue<T> @object)
    {
        var json = JsonSerializer.Serialize(@object.Value);

        var storage = @object is LocalStorageValue<T>
            ? _local : _session;

        return _js.InvokeVoidAsync(_setFunc, 
            storage, @object.Key, json);
    }

    public async ValueTask<T> ResolveAsync<T>(StorageValue<T> @object)
    {
        var storage = @object is LocalStorageValue<T>
            ? _local : _session;

        var value = await _js.InvokeAsync<string>(
            _getFunc, storage, @object.Key);

        return JsonSerializer.Deserialize<T>(value);
    }
}