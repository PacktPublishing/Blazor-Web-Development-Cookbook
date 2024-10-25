namespace BlazorCookbook.App.Client.Chapters.Chapter05.Recipe07;

public record LocalStorageValue<T> : StorageValue<T>;
public record SessionStorageValue<T> : StorageValue<T>;

public abstract record StorageValue<T>
{
    public string Key { get; init; }
    public T Value { get; init; }
}