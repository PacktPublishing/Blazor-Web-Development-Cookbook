namespace BlazorCookbook.App.Client.Chapters.Chapter01.Recipe05;

public class Cart(Action onStateHasChanged)
{
    public List<string> Content { get; init; } = [];
    public decimal Value { get; private set; }

    public int Volume => Content.Count;
    public void Add(string tariff, decimal price)
    {
        Content.Add(tariff);
        Value += price;
        onStateHasChanged.Invoke();
    }
}
