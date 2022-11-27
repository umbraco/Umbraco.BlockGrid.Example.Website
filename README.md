# Umbraco Block Grid Example Website
An example of Umbraco Block Grid as a simple installable starter kit. This package is to help showcase what can be achieved with the new block grid editor in Umbraco.

> **Note** 
> This requires .NET7+ and Umbraco 11.0.0+

## Contributing
This package is open to be collobrated on with the wider Umbraco community.

You can get up and running really quickly by cloning down the website and running dotnet build at the root of the repository and running the website found in `UmbracoBlockGrid.Site`

```
dotnet build UmbracoBlockGrid.sln
cd UmbracoBlockGrid.Site
dotnet run 
```

### Dependencies

We are using the community package uSync from Kevin Jump in order to synchronize changes to document types and configuration, as the base product is free and open source for all to use.
