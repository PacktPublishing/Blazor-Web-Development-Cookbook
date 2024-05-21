namespace BlazorCookbook.App.Client.Chapters.Chapter05.Recipe03;

public sealed class StoreState
{
    public event Func<StateArgs, Task> OnChanged;
    public Task Notify(StateArgs args)
        => OnChanged?.Invoke(args);
}
