namespace BlazorCookbook.App.Client.Chapters.Chapter05.Recipe02;

public class StateContainer<T>
{
    private readonly Dictionary<Guid, T> _container = [];

    public void Persist(Guid key, T value)
        => _container.TryAdd(key, value);

    public T Resolve(Guid key) => _container[key];
}