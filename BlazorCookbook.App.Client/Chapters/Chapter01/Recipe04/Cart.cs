namespace BlazorCookbook.App.Client.Chapters.Chapter01.Recipe04;

public class Cart(Action onStateHasChanged)
{
    private readonly Action _onStateHasChanged = onStateHasChanged;

    public List<string> Content { get; init; } = [];
    public decimal Value { get; private set; }

    public int Volume => Content.Count;
    public void Add(string tariff, decimal price)
    {
        Content.Add(tariff);
        Value += price;
        _onStateHasChanged.Invoke();
    }
}
